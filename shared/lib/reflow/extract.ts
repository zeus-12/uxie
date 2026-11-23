import { OPS } from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";
import type {
  PDFOperatorList,
  StructTreeNode,
  TextContent,
  TextItem,
  TextMarkedContent,
} from "pdfjs-dist/types/src/display/api";
import {
  IDENTITY,
  apply,
  boundsOf,
  clampTo,
  multiply,
  toMatrix,
  transformBox,
  type Matrix,
} from "./geometry";
import type { PageInput, Rect, SourceItem } from "./types";

const WIDGET_ANNOTATION = 20;

const isMarked = (entry: TextItem | TextMarkedContent): entry is TextMarkedContent =>
  !("str" in entry);

const IMAGE_OPS = new Set<number>([
  OPS.paintJpegXObject,
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageMaskXObject,
  OPS.paintSolidColorImageMask,
  OPS.paintImageXObjectRepeat,
  OPS.paintImageMaskXObjectRepeat,
]);

const PAINT_OPS = new Set<number>([
  OPS.stroke,
  OPS.closeStroke,
  OPS.fill,
  OPS.eoFill,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);

const readFontFace = (page: PDFPageProxy, fontName: string): string | null => {
  try {
    const font = page.commonObjs.get(fontName) as { name?: unknown } | undefined;
    return typeof font?.name === "string" ? font.name : null;
  } catch {
    return null;
  }
};

export const readItems = (
  content: TextContent,
  viewportTransform: Matrix,
  fontFace: (fontName: string) => string | null,
): SourceItem[] => {
  const items: SourceItem[] = [];
  const marks: Array<{ tag: string | null; id: string | null }> = [];
  let index = 0;
  for (const entry of content.items) {
    if (isMarked(entry)) {
      if (entry.type === "endMarkedContent") marks.pop();
      else {
        const tag = (entry as { tag?: unknown }).tag;
        marks.push({
          tag: typeof tag === "string" ? tag : null,
          id: typeof entry.id === "string" ? entry.id : null,
        });
      }
      continue;
    }
    const itemIndex = index++;
    const itemMatrix = toMatrix(entry.transform);
    if (!itemMatrix) continue;
    const m = multiply(viewportTransform, itemMatrix);
    const hScale = Math.hypot(m[0], m[1]) || 1;
    const vScale = Math.hypot(m[2], m[3]) || hScale;
    const style = content.styles[entry.fontName];
    const metricsKnown =
      Number.isFinite(style?.ascent) &&
      Number.isFinite(style?.descent) &&
      style!.ascent - style!.descent > 0.5;
    const ascent = metricsKnown ? style!.ascent : 0.8;
    const descent = metricsKnown ? style!.descent : -0.2;
    const ux = m[0] / hScale;
    const uy = m[1] / hScale;
    const vx = m[2] / vScale;
    const vy = m[3] / vScale;
    const at = (along: number, up: number): [number, number] => [
      m[4] + ux * along + vx * vScale * up,
      m[5] + uy * along + vy * vScale * up,
    ];
    const w = entry.width;
    const rect = boundsOf([at(0, ascent), at(w, ascent), at(0, descent), at(w, descent)]);
    const horizontal =
      m[0] > 0 &&
      m[3] < 0 &&
      Math.abs(m[1]) < 0.02 * Math.abs(m[0]) &&
      Math.abs(m[2]) < 0.02 * Math.abs(m[3]);
    const markedTag = [...marks].reverse().find((mk) => mk.tag)?.tag ?? null;
    const markedId = [...marks].reverse().find((mk) => mk.id)?.id ?? null;
    items.push({
      index: itemIndex,
      str: entry.str,
      rect,
      baseline: m[5],
      fontSize: vScale,
      fontName: entry.fontName,
      fontFace: fontFace(entry.fontName),
      horizontal,
      direction: entry.dir,
      hasEOL: entry.hasEOL,
      markedTag,
      markedId,
      artifact: marks.some((mk) => mk.tag === "Artifact"),
    });
  }
  return items;
};

export const readGraphics = (
  list: PDFOperatorList,
  viewportTransform: Matrix,
): { images: Rect[]; paths: Rect[] } => {
  const images: Rect[] = [];
  const paths: Rect[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;
  let pending: Rect[] = [];

  list.fnArray.forEach((op, i) => {
    const args = list.argsArray[i] as unknown[] | null;
    switch (op) {
      case OPS.save:
        stack.push(ctm);
        return;
      case OPS.restore:
        ctm = stack.pop() ?? IDENTITY;
        return;
      case OPS.transform: {
        const m = toMatrix(args);
        if (m) ctm = multiply(ctm, m);
        return;
      }
      case OPS.paintFormXObjectBegin: {
        stack.push(ctm);
        const m = toMatrix(args?.[0]);
        if (m) ctm = multiply(ctm, m);
        return;
      }
      case OPS.paintFormXObjectEnd:
        ctm = stack.pop() ?? IDENTITY;
        return;
      case OPS.constructPath: {
        const minMax = args?.[2];
        if (Array.isArray(minMax) && minMax.length === 4) {
          const [x0, x1, y0, y1] = minMax as number[];
          if ([x0, x1, y0, y1].every((v) => Number.isFinite(v))) {
            pending.push(transformBox(multiply(viewportTransform, ctm), x0!, y0!, x1!, y1!));
          }
        }
        return;
      }
      case OPS.endPath:
        pending = [];
        return;
    }
    if (PAINT_OPS.has(op)) {
      paths.push(...pending);
      pending = [];
      return;
    }
    if (IMAGE_OPS.has(op)) {
      const m = multiply(viewportTransform, ctm);
      images.push(boundsOf([apply(m, 0, 0), apply(m, 1, 0), apply(m, 0, 1), apply(m, 1, 1)]));
    }
  });
  return { images, paths };
};

const collectStructRoles = (tree: StructTreeNode | null): Record<string, string> => {
  const roles: Record<string, string> = {};
  const visit = (node: StructTreeNode, inherited: string | null) => {
    const role = node.role && node.role !== "Root" ? node.role : inherited;
    for (const child of node.children ?? []) {
      if ("role" in child) visit(child, role);
      else if (child.type === "content" && role) roles[child.id] = role;
    }
  };
  if (tree) visit(tree, null);
  return roles;
};

const itemStringsOf = (content: TextContent) =>
  content.items.filter((e): e is TextItem => !isMarked(e)).map((e) => e.str);

export const viewportMatrix = (page: PDFPageProxy) => {
  const viewport = page.getViewport({ scale: 1 });
  const m = toMatrix(viewport.transform);
  if (!m) throw new Error(`Invalid viewport transform on page ${page.pageNumber}`);
  return { viewport, matrix: m };
};

export const extractPageInput = async (page: PDFPageProxy): Promise<PageInput> => {
  const { viewport, matrix } = viewportMatrix(page);
  const operatorList = await page.getOperatorList();
  const [content, annotations, structTree] = await Promise.all([
    page.getTextContent({ includeMarkedContent: true, disableCombineTextItems: false }),
    page.getAnnotations({ intent: "display" }),
    page.getStructTree().catch(() => null),
  ]);
  const graphics = readGraphics(operatorList, matrix);
  const clamp = (r: Rect) => clampTo(r, viewport.width, viewport.height);
  return {
    pageNumber: page.pageNumber,
    width: viewport.width,
    height: viewport.height,
    items: readItems(content, matrix, (name) => readFontFace(page, name)),
    itemStrings: itemStringsOf(content),
    images: graphics.images.map(clamp).filter((r): r is Rect => r !== null),
    paths: graphics.paths
      .map((r) => clampTo({ ...r, width: Math.max(r.width, 0.01), height: Math.max(r.height, 0.01) }, viewport.width, viewport.height))
      .filter((r): r is Rect => r !== null),
    formWidgetCount: (annotations as Array<{ annotationType?: number }>).filter(
      (a) => a.annotationType === WIDGET_ANNOTATION,
    ).length,
    structRoles: collectStructRoles(structTree as StructTreeNode | null),
  };
};

export const extractTextOnly = async (page: PDFPageProxy): Promise<PageInput> => {
  const { viewport, matrix } = viewportMatrix(page);
  const content = await page.getTextContent({ includeMarkedContent: true, disableCombineTextItems: false });
  return {
    pageNumber: page.pageNumber,
    width: viewport.width,
    height: viewport.height,
    items: readItems(content, matrix, () => null),
    itemStrings: itemStringsOf(content),
    images: [],
    paths: [],
    formWidgetCount: 0,
    structRoles: {},
  };
};

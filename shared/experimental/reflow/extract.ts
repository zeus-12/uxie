import { OPS } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type {
  PDFOperatorList,
  StructTreeNode,
  TextContent,
  TextItem,
  TextMarkedContent,
  TextStyle,
} from "pdfjs-dist/types/src/display/api";
import type {
  ExtractedPage,
  ExtractedTextItem,
  GraphicRegion,
  PdfRect,
} from "./model";

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const matrixFrom = (value: unknown): Matrix | null => {
  if (!Array.isArray(value) || value.length !== 6) return null;
  const [a, b, c, d, e, f] = value;
  if (
    !isFiniteNumber(a) ||
    !isFiniteNumber(b) ||
    !isFiniteNumber(c) ||
    !isFiniteNumber(d) ||
    !isFiniteNumber(e) ||
    !isFiniteNumber(f)
  ) {
    return null;
  }
  return [a, b, c, d, e, f];
};

const multiply = (first: Matrix, second: Matrix): Matrix => [
  first[0] * second[0] + first[2] * second[1],
  first[1] * second[0] + first[3] * second[1],
  first[0] * second[2] + first[2] * second[3],
  first[1] * second[2] + first[3] * second[3],
  first[0] * second[4] + first[2] * second[5] + first[4],
  first[1] * second[4] + first[3] * second[5] + first[5],
];

const applyMatrix = (
  matrix: Matrix,
  point: [number, number],
): [number, number] => [
  point[0] * matrix[0] + point[1] * matrix[2] + matrix[4],
  point[0] * matrix[1] + point[1] * matrix[3] + matrix[5],
];

const rectFromPoints = (points: Array<[number, number]>): PdfRect => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { x: left, y: top, width: right - left, height: bottom - top };
};

const textItemRect = (
  item: TextItem,
  style: TextStyle | undefined,
  viewportTransform: Matrix,
): { rect: PdfRect; baseline: number; fontSize: number } | null => {
  const itemTransform = matrixFrom(item.transform);
  if (!itemTransform) return null;
  const transform = multiply(viewportTransform, itemTransform);
  const horizontalScale = Math.hypot(transform[0], transform[1]) || 1;
  const verticalScale =
    Math.hypot(transform[2], transform[3]) || horizontalScale;
  const horizontal: [number, number] = [
    transform[0] / horizontalScale,
    transform[1] / horizontalScale,
  ];
  const vertical: [number, number] = [
    transform[2] / verticalScale,
    transform[3] / verticalScale,
  ];
  const ascent = isFiniteNumber(style?.ascent) ? style.ascent : 0.8;
  const descent = isFiniteNumber(style?.descent) ? style.descent : -0.2;
  const baseline: [number, number] = [transform[4], transform[5]];
  const end: [number, number] = [
    baseline[0] + horizontal[0] * item.width,
    baseline[1] + horizontal[1] * item.width,
  ];
  const offset = (
    point: [number, number],
    amount: number,
  ): [number, number] => [
    point[0] + vertical[0] * verticalScale * amount,
    point[1] + vertical[1] * verticalScale * amount,
  ];
  const topStart = offset(baseline, ascent);
  const topEnd = offset(end, ascent);
  const bottomStart = offset(baseline, descent);
  const bottomEnd = offset(end, descent);
  return {
    rect: rectFromPoints([topStart, topEnd, bottomStart, bottomEnd]),
    baseline: transform[5],
    fontSize: verticalScale,
  };
};

const directionFrom = (value: string): ExtractedTextItem["direction"] => {
  if (value === "ltr" || value === "rtl" || value === "ttb") return value;
  return "unknown";
};

const isMarkedContent = (
  item: TextItem | TextMarkedContent,
): item is TextMarkedContent => "type" in item;

const normalizeItemText = (value: string) => value.replace(/\s+/g, " ").trim();

const extractTextItems = (
  textContent: TextContent,
  viewportTransform: Matrix,
): { items: ExtractedTextItem[]; pageText: string } => {
  const extracted: ExtractedTextItem[] = [];
  const markedContentStack: Array<string | null> = [];
  let pageText = "";

  textContent.items.forEach((entry, sourceIndex) => {
    if (isMarkedContent(entry)) {
      if (entry.type === "endMarkedContent") {
        markedContentStack.pop();
      } else if (entry.type === "beginMarkedContentProps") {
        markedContentStack.push(typeof entry.id === "string" ? entry.id : null);
      } else if (entry.type === "beginMarkedContent") {
        markedContentStack.push(null);
      }
      return;
    }
    const value = normalizeItemText(entry.str);
    if (!value) return;
    const style = textContent.styles[entry.fontName];
    const geometry = textItemRect(entry, style, viewportTransform);
    if (!geometry) return;
    if (pageText.length > 0) pageText += " ";
    const textStart = pageText.length;
    pageText += value;
    extracted.push({
      sourceIndex,
      textStart,
      textEnd: pageText.length,
      str: value,
      direction: directionFrom(entry.dir),
      fontName: entry.fontName,
      fontFamily: style?.fontFamily ?? "unknown",
      fontSize: geometry.fontSize,
      hasEol: entry.hasEOL,
      markedContentId:
        [...markedContentStack].reverse().find((id) => id !== null) ?? null,
      baseline: geometry.baseline,
      rect: geometry.rect,
    });
  });

  return { items: extracted, pageText };
};

const collectStructTreeRoles = (tree: StructTreeNode | null): string[] => {
  if (!tree) return [];
  const roles: string[] = [];
  const visit = (node: StructTreeNode) => {
    roles.push(node.role);
    for (const child of node.children) {
      if ("role" in child) visit(child);
    }
  };
  visit(tree);
  return roles;
};

const imageOperator = (operator: number) =>
  operator === OPS.paintJpegXObject ||
  operator === OPS.paintImageXObject ||
  operator === OPS.paintInlineImageXObject ||
  operator === OPS.paintImageMaskXObject ||
  operator === OPS.paintSolidColorImageMask;

const vectorPaintOperator = (operator: number) =>
  operator === OPS.stroke ||
  operator === OPS.closeStroke ||
  operator === OPS.fill ||
  operator === OPS.eoFill ||
  operator === OPS.fillStroke ||
  operator === OPS.eoFillStroke ||
  operator === OPS.closeFillStroke ||
  operator === OPS.closeEOFillStroke ||
  operator === OPS.shadingFill;

const inspectOperators = (
  list: PDFOperatorList,
  viewportTransform: Matrix,
): { graphicRegions: GraphicRegion[]; vectorPaintCount: number } => {
  const graphicRegions: GraphicRegion[] = [];
  const stack: Matrix[] = [];
  let current: Matrix = IDENTITY;
  let vectorPaintCount = 0;

  list.fnArray.forEach((operator, index) => {
    if (operator === OPS.save) {
      stack.push(current);
      return;
    }
    if (operator === OPS.restore) {
      current = stack.pop() ?? IDENTITY;
      return;
    }
    if (operator === OPS.transform) {
      const args = list.argsArray[index];
      const transform = matrixFrom(args);
      if (transform) current = multiply(current, transform);
      return;
    }
    if (vectorPaintOperator(operator)) vectorPaintCount += 1;
    if (!imageOperator(operator)) return;
    const pageMatrix = multiply(viewportTransform, current);
    const rect = rectFromPoints([
      applyMatrix(pageMatrix, [0, 0]),
      applyMatrix(pageMatrix, [1, 0]),
      applyMatrix(pageMatrix, [0, 1]),
      applyMatrix(pageMatrix, [1, 1]),
    ]);
    if (rect.width > 0 && rect.height > 0) {
      graphicRegions.push({ kind: "raster-image", rect });
    }
  });
  return { graphicRegions, vectorPaintCount };
};

const textItemCount = (content: TextContent) =>
  content.items.filter((item) => !isMarkedContent(item)).length;

export const extractPage = async (
  page: PDFPageProxy,
): Promise<ExtractedPage> => {
  const viewport = page.getViewport({ scale: 1 });
  const viewportTransform = matrixFrom(viewport.transform);
  if (!viewportTransform) {
    throw new Error(
      `PDF.js returned an invalid viewport transform for page ${page.pageNumber}`,
    );
  }
  const [combined, uncombined, structTree, operatorList, annotations] =
    await Promise.all([
      page.getTextContent({
        disableCombineTextItems: false,
        includeMarkedContent: true,
      }),
      page.getTextContent({
        disableCombineTextItems: true,
        includeMarkedContent: false,
      }),
      page.getStructTree().catch(() => null),
      page.getOperatorList(),
      page.getAnnotations({ intent: "display" }),
    ]);
  const { items, pageText } = extractTextItems(combined, viewportTransform);
  const operatorInspection = inspectOperators(operatorList, viewportTransform);
  return {
    pageNumber: page.pageNumber,
    width: viewport.width,
    height: viewport.height,
    pageText,
    items,
    graphicRegions: operatorInspection.graphicRegions,
    diagnostics: {
      combinedItemCount: textItemCount(combined),
      uncombinedItemCount: textItemCount(uncombined),
      annotationCount: annotations.length,
      operatorCount: operatorList.fnArray.length,
      vectorPaintCount: operatorInspection.vectorPaintCount,
      structTreeRoles: collectStructTreeRoles(structTree),
      markedContentItemCount: items.filter(
        (item) => item.markedContentId !== null,
      ).length,
    },
  };
};

export const extractDocument = async (
  document: PDFDocumentProxy,
  onProgress?: (completedPages: number, totalPages: number) => void,
): Promise<ExtractedPage[]> => {
  const pages: ExtractedPage[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    pages.push(await extractPage(page));
    onProgress?.(pageNumber, document.numPages);
  }
  return pages;
};

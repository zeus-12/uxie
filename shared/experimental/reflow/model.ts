/**
 * EXPERIMENTAL PROTOTYPE
 *
 * Question: can PDF.js geometry support a conservative, anchored reading view
 * for ordinary one- and two-column PDFs without pretending to understand every
 * page? This module is pure so the reconstruction rules can be exercised apart
 * from PDF.js and the throwaway UI.
 */

export type PdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExtractedTextItem = {
  sourceIndex: number;
  textStart: number;
  textEnd: number;
  str: string;
  direction: "ltr" | "rtl" | "ttb" | "unknown";
  fontName: string;
  fontFamily: string;
  fontSize: number;
  hasEol: boolean;
  markedContentId: string | null;
  baseline: number;
  rect: PdfRect;
};

export type GraphicRegion = {
  kind: "raster-image";
  rect: PdfRect;
};

export type ExtractedPage = {
  pageNumber: number;
  width: number;
  height: number;
  pageText: string;
  items: ExtractedTextItem[];
  graphicRegions: GraphicRegion[];
  diagnostics: {
    combinedItemCount: number;
    uncombinedItemCount: number;
    annotationCount: number;
    operatorCount: number;
    vectorPaintCount: number;
    structTreeRoles: string[];
    markedContentItemCount: number;
  };
};

export type SourceAnchor = {
  pageNumber: number;
  extractionVersion: "pdfjs-2.16.105-combined-v1";
  itemRange: { start: number; end: number } | null;
  textRange: { start: number; end: number } | null;
  quote: { exact: string; prefix: string; suffix: string } | null;
  rects: PdfRect[];
  boundingRect: PdfRect;
};

type TextBlockBase = {
  id: string;
  text: string;
  anchor: SourceAnchor;
};

export type ReflowBlock =
  | (TextBlockBase & { kind: "heading"; level: 1 | 2 | 3 })
  | (TextBlockBase & { kind: "paragraph" })
  | (TextBlockBase & { kind: "list-item" })
  | (TextBlockBase & { kind: "caption" })
  | (TextBlockBase & { kind: "footnote" })
  | {
      id: string;
      kind: "figure";
      caption: string | null;
      anchor: SourceAnchor;
      crop: PdfRect;
    };

export type PageFallbackReason =
  | "no-text-layer"
  | "too-little-text"
  | "unsupported-writing-direction"
  | "table-grid"
  | "equation-dense"
  | "vector-heavy"
  | "corrupt-font-mapping"
  | "layout-ambiguous";

export type PageDiagnostics = ExtractedPage["diagnostics"] & {
  characterCount: number;
  detectedColumns: 0 | 1 | 2;
  bodyFontSize: number | null;
  lineCount: number;
  blockCount: number;
  largeImageCount: number;
  tableRowCount: number;
  equationLineCount: number;
};

export type ReflowPage =
  | {
      kind: "reflowed";
      pageNumber: number;
      width: number;
      height: number;
      blocks: ReflowBlock[];
      diagnostics: PageDiagnostics;
    }
  | {
      kind: "fallback";
      pageNumber: number;
      width: number;
      height: number;
      reason: PageFallbackReason;
      anchor: SourceAnchor;
      diagnostics: PageDiagnostics;
    };

export type ReflowDocument = {
  qualification: "supported" | "mixed" | "unsupported";
  pages: ReflowPage[];
  supportedPageCount: number;
  fallbackPageCount: number;
};

type Column = "full" | "left" | "right";

type Line = {
  text: string;
  items: ExtractedTextItem[];
  rect: PdfRect;
  baseline: number;
  fontSize: number;
  column: Column;
};

type DraftBlock = {
  kind: Exclude<ReflowBlock["kind"], "figure">;
  text: string;
  lines: Line[];
  column: Column;
  firstY: number;
};

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  const value = ordered[middle];
  if (value === undefined) return 0;
  if (ordered.length % 2 === 1) return value;
  return ((ordered[middle - 1] ?? value) + value) / 2;
};

const rectRight = (rect: PdfRect) => rect.x + rect.width;
const rectBottom = (rect: PdfRect) => rect.y + rect.height;

export const unionRects = (rects: PdfRect[]): PdfRect => {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const first = rects[0];
  if (!first) return { x: 0, y: 0, width: 0, height: 0 };
  let left = first.x;
  let top = first.y;
  let right = rectRight(first);
  let bottom = rectBottom(first);
  for (const rect of rects.slice(1)) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rectRight(rect));
    bottom = Math.max(bottom, rectBottom(rect));
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
};

const joinItemText = (items: ExtractedTextItem[]): string => {
  let text = "";
  let previous: ExtractedTextItem | null = null;
  for (const item of items) {
    const value = normalizeWhitespace(item.str);
    if (!value) continue;
    if (previous) {
      const gap = item.rect.x - rectRight(previous.rect);
      const needsSpace =
        gap >
          Math.max(0.75, Math.min(previous.fontSize, item.fontSize) * 0.12) &&
        !/[-/([\u2018\u201c]$/.test(text) &&
        !/^[,.;:!?%)\]\u2019\u201d]/.test(value);
      if (needsSpace) text += " ";
    }
    text += value;
    previous = item;
  }
  return normalizeWhitespace(text);
};

const makeInitialLines = (page: ExtractedPage): Line[] => {
  const items = page.items
    .filter((item) => normalizeWhitespace(item.str).length > 0)
    .sort((a, b) => a.baseline - b.baseline || a.rect.x - b.rect.x);
  const bands: ExtractedTextItem[][] = [];

  for (const item of items) {
    let closest: ExtractedTextItem[] | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (let index = bands.length - 1; index >= 0; index -= 1) {
      const band = bands[index];
      if (!band) continue;
      const bandBaseline =
        band.reduce((sum, entry) => sum + entry.baseline, 0) / band.length;
      const distance = Math.abs(item.baseline - bandBaseline);
      const tolerance = Math.max(
        2,
        Math.max(item.fontSize, ...band.map((entry) => entry.fontSize)) * 0.34,
      );
      if (distance <= tolerance && distance < closestDistance) {
        closest = band;
        closestDistance = distance;
      }
      if (bandBaseline < item.baseline - tolerance * 2) break;
    }
    if (closest) closest.push(item);
    else bands.push([item]);
  }

  const lines: Line[] = [];
  for (const band of bands) {
    const ordered = [...band].sort((a, b) => a.rect.x - b.rect.x);
    const bandFontSize = median(ordered.map((item) => item.fontSize));
    const splitGap = Math.max(12, page.width * 0.025, bandFontSize * 1.5);
    let segment: ExtractedTextItem[] = [];
    for (const item of ordered) {
      const previous = segment[segment.length - 1];
      if (previous && item.rect.x - rectRight(previous.rect) > splitGap) {
        const text = joinItemText(segment);
        if (text) {
          lines.push({
            text,
            items: segment,
            rect: unionRects(segment.map((entry) => entry.rect)),
            baseline: median(segment.map((entry) => entry.baseline)),
            fontSize: median(segment.map((entry) => entry.fontSize)),
            column: "full",
          });
        }
        segment = [];
      }
      segment.push(item);
    }
    const text = joinItemText(segment);
    if (text) {
      lines.push({
        text,
        items: segment,
        rect: unionRects(segment.map((entry) => entry.rect)),
        baseline: median(segment.map((entry) => entry.baseline)),
        fontSize: median(segment.map((entry) => entry.fontSize)),
        column: "full",
      });
    }
  }
  return lines.sort((a, b) => a.baseline - b.baseline || a.rect.x - b.rect.x);
};

const detectColumns = (
  lines: Line[],
  pageWidth: number,
): { count: 1 | 2; gutter: number | null } => {
  const candidates = lines.filter(
    (line) => line.rect.width < pageWidth * 0.54 && line.text.length >= 8,
  );
  if (candidates.length < 8) return { count: 1, gutter: null };

  let leftCenter = Math.min(...candidates.map((line) => line.rect.x));
  let rightCenter = Math.max(...candidates.map((line) => line.rect.x));
  if (rightCenter - leftCenter < pageWidth * 0.22) {
    return { count: 1, gutter: null };
  }

  let leftGroup: Line[] = [];
  let rightGroup: Line[] = [];
  for (let iteration = 0; iteration < 8; iteration += 1) {
    leftGroup = [];
    rightGroup = [];
    for (const line of candidates) {
      if (
        Math.abs(line.rect.x - leftCenter) <=
        Math.abs(line.rect.x - rightCenter)
      ) {
        leftGroup.push(line);
      } else {
        rightGroup.push(line);
      }
    }
    if (leftGroup.length > 0) {
      leftCenter =
        leftGroup.reduce((sum, line) => sum + line.rect.x, 0) /
        leftGroup.length;
    }
    if (rightGroup.length > 0) {
      rightCenter =
        rightGroup.reduce((sum, line) => sum + line.rect.x, 0) /
        rightGroup.length;
    }
  }

  const smallerGroup = Math.min(leftGroup.length, rightGroup.length);
  const separation = rightCenter - leftCenter;
  if (smallerGroup < 4 || separation < pageWidth * 0.28) {
    return { count: 1, gutter: null };
  }

  const leftRight = median(leftGroup.map((line) => rectRight(line.rect)));
  const rightLeft = median(rightGroup.map((line) => line.rect.x));
  return { count: 2, gutter: (leftRight + rightLeft) / 2 };
};

const orderLines = (
  source: Line[],
  pageWidth: number,
  columns: { count: 1 | 2; gutter: number | null },
): Line[] => {
  if (columns.count === 1 || columns.gutter === null) {
    return source
      .map((line) => ({ ...line, column: "full" as const }))
      .sort((a, b) => a.baseline - b.baseline || a.rect.x - b.rect.x);
  }

  const gutter = columns.gutter;
  const lines = source.map((line): Line => {
    const crossesBothColumns =
      line.rect.x < gutter - pageWidth * 0.12 &&
      rectRight(line.rect) > gutter + pageWidth * 0.12;
    const isFull = line.rect.width > pageWidth * 0.72 || crossesBothColumns;
    const center = line.rect.x + line.rect.width / 2;
    return {
      ...line,
      column: isFull ? "full" : center < gutter ? "left" : "right",
    };
  });
  const fullLines = lines
    .filter((line) => line.column === "full")
    .sort((a, b) => a.baseline - b.baseline);
  const ordered: Line[] = [];
  let regionTop = Number.NEGATIVE_INFINITY;

  const appendRegion = (regionBottom: number) => {
    const region = lines.filter(
      (line) =>
        line.column !== "full" &&
        line.baseline > regionTop &&
        line.baseline < regionBottom,
    );
    ordered.push(
      ...region
        .filter((line) => line.column === "left")
        .sort((a, b) => a.baseline - b.baseline || a.rect.x - b.rect.x),
      ...region
        .filter((line) => line.column === "right")
        .sort((a, b) => a.baseline - b.baseline || a.rect.x - b.rect.x),
    );
  };

  for (const fullLine of fullLines) {
    appendRegion(fullLine.baseline);
    ordered.push(fullLine);
    regionTop = fullLine.baseline;
  }
  appendRegion(Number.POSITIVE_INFINITY);
  return ordered;
};

const detectTableRows = (lines: Line[], bodyFontSize: number): number => {
  const tolerance = Math.max(2, bodyFontSize * 0.45);
  const rows: Line[][] = [];
  for (const line of [...lines].sort((a, b) => a.baseline - b.baseline)) {
    const row = rows.find(
      (candidate) =>
        Math.abs((candidate[0]?.baseline ?? line.baseline) - line.baseline) <=
        tolerance,
    );
    if (row) row.push(line);
    else rows.push([line]);
  }
  return rows.filter(
    (row) =>
      row.length >= 3 &&
      row.filter((line) => line.text.length <= 42).length >= 3,
  ).length;
};

const equationCharacters =
  /[=+\u2212\u00d7\u00f7\u2211\u222b\u221a\u00b1\u2264\u2265\u2248\u2260^_{}[\]]/g;

const countEquationLines = (lines: Line[]): number =>
  lines.filter((line) => {
    const symbols = line.text.match(equationCharacters)?.length ?? 0;
    return line.text.length > 0 && symbols / line.text.length >= 0.14;
  }).length;

const suspiciousCharacterCount = (value: string) =>
  value.match(/[<>=@#$^_*]/g)?.length ?? 0;

const hasCorruptFontMapping = (
  lines: Line[],
  items: ExtractedTextItem[],
): boolean => {
  if (
    lines.some(
      (line) =>
        line.text.length >= 100 &&
        suspiciousCharacterCount(line.text) / line.text.length >= 0.1,
    )
  ) {
    return true;
  }
  const suspiciousItemCharacters = items
    .filter(
      (item) =>
        item.str.length >= 8 &&
        suspiciousCharacterCount(item.str) / item.str.length >= 0.12,
    )
    .reduce((sum, item) => sum + item.str.length, 0);
  return suspiciousItemCharacters >= 80;
};

const classifyLine = (
  line: Line,
  bodyFontSize: number,
  pageHeight: number,
): DraftBlock["kind"] => {
  if (/^(figure|fig\.?|image)\s*\d+/i.test(line.text)) return "caption";
  if (line.rect.y > pageHeight * 0.72 && line.fontSize < bodyFontSize * 0.8) {
    return "footnote";
  }
  const numberedHeading = /^(?:\d+\.\s+|\d+(?:\.\d+)+\.?\s+)\D/.test(line.text);
  if (
    line.text.length <= 150 &&
    (line.fontSize >= bodyFontSize * 1.18 ||
      (numberedHeading && line.fontSize >= bodyFontSize * 0.96))
  ) {
    return "heading";
  }
  if (/^(?:[\u2022\u25e6\u25aa*-]|\(?\d+[.)]|[a-z][.)])\s+/i.test(line.text)) {
    return "list-item";
  }
  return "paragraph";
};

const canMergeParagraphLines = (
  previous: Line,
  next: Line,
  bodyFontSize: number,
  pageWidth: number,
) =>
  previous.column === next.column &&
  next.baseline - previous.baseline <= bodyFontSize * 1.62 &&
  Math.abs(previous.rect.x - next.rect.x) <= pageWidth * 0.09;

const buildDraftBlocks = (
  lines: Line[],
  bodyFontSize: number,
  page: ExtractedPage,
): DraftBlock[] => {
  const blocks: DraftBlock[] = [];
  for (const line of lines) {
    const kind = classifyLine(line, bodyFontSize, page.height);
    const previous = blocks[blocks.length - 1];
    const previousLine = previous?.lines[previous.lines.length - 1];
    if (
      kind === "paragraph" &&
      previous?.kind === "paragraph" &&
      previousLine &&
      canMergeParagraphLines(previousLine, line, bodyFontSize, page.width)
    ) {
      const joinsHyphen = /[-\u2010\u2011]$/.test(previous.text);
      previous.text = joinsHyphen
        ? `${previous.text.slice(0, -1)}${line.text}`
        : `${previous.text} ${line.text}`;
      previous.lines.push(line);
      continue;
    }
    blocks.push({
      kind,
      text: line.text,
      lines: [line],
      column: line.column,
      firstY: line.rect.y,
    });
  }
  return blocks;
};

const quoteAround = (
  pageText: string,
  textRange: { start: number; end: number },
  exactText: string,
): SourceAnchor["quote"] => ({
  exact: normalizeWhitespace(exactText).slice(0, 280),
  prefix: normalizeWhitespace(
    pageText.slice(Math.max(0, textRange.start - 48), textRange.start),
  ),
  suffix: normalizeWhitespace(
    pageText.slice(textRange.end, textRange.end + 48),
  ),
});

const anchorForItems = (
  page: ExtractedPage,
  items: ExtractedTextItem[],
  exactText: string,
  extraRects: PdfRect[] = [],
): SourceAnchor => {
  const itemRects = items.map((item) => item.rect);
  const rects = [...itemRects, ...extraRects];
  const boundingRect = unionRects(rects);
  if (items.length === 0) {
    return {
      pageNumber: page.pageNumber,
      extractionVersion: "pdfjs-2.16.105-combined-v1",
      itemRange: null,
      textRange: null,
      quote: exactText
        ? { exact: normalizeWhitespace(exactText), prefix: "", suffix: "" }
        : null,
      rects,
      boundingRect,
    };
  }
  const sourceIndexes = items.map((item) => item.sourceIndex);
  const textRange = {
    start: Math.min(...items.map((item) => item.textStart)),
    end: Math.max(...items.map((item) => item.textEnd)),
  };
  return {
    pageNumber: page.pageNumber,
    extractionVersion: "pdfjs-2.16.105-combined-v1",
    itemRange: {
      start: Math.min(...sourceIndexes),
      end: Math.max(...sourceIndexes) + 1,
    },
    textRange,
    quote: quoteAround(page.pageText, textRange, exactText),
    rects,
    boundingRect,
  };
};

const fullPageAnchor = (page: ExtractedPage): SourceAnchor => {
  const exact = normalizeWhitespace(page.pageText).slice(0, 280);
  return {
    pageNumber: page.pageNumber,
    extractionVersion: "pdfjs-2.16.105-combined-v1",
    itemRange:
      page.items.length > 0 ? { start: 0, end: page.items.length } : null,
    textRange:
      page.pageText.length > 0 ? { start: 0, end: page.pageText.length } : null,
    quote: exact ? { exact, prefix: "", suffix: "" } : null,
    rects: [{ x: 0, y: 0, width: page.width, height: page.height }],
    boundingRect: { x: 0, y: 0, width: page.width, height: page.height },
  };
};

const headingLevel = (fontSize: number, bodyFontSize: number): 1 | 2 | 3 => {
  if (fontSize >= bodyFontSize * 1.7) return 1;
  if (fontSize >= bodyFontSize * 1.35) return 2;
  return 3;
};

const blockFromDraft = (
  page: ExtractedPage,
  draft: DraftBlock,
  bodyFontSize: number,
  index: number,
): ReflowBlock => {
  const items = draft.lines.flatMap((line) => line.items);
  const base = {
    id: `p${page.pageNumber}-b${index}`,
    text: normalizeWhitespace(draft.text),
    anchor: anchorForItems(page, items, draft.text),
  };
  switch (draft.kind) {
    case "heading":
      return {
        ...base,
        kind: "heading",
        level: headingLevel(
          median(draft.lines.map((line) => line.fontSize)),
          bodyFontSize,
        ),
      };
    case "paragraph":
      return { ...base, kind: "paragraph" };
    case "list-item":
      return { ...base, kind: "list-item" };
    case "caption":
      return { ...base, kind: "caption" };
    case "footnote":
      return { ...base, kind: "footnote" };
    default: {
      const exhaustive: never = draft.kind;
      return exhaustive;
    }
  }
};

const largeImages = (page: ExtractedPage): GraphicRegion[] =>
  page.graphicRegions.filter(
    (graphic) =>
      graphic.rect.width * graphic.rect.height >=
        page.width * page.height * 0.025 &&
      graphic.rect.width >= page.width * 0.12 &&
      graphic.rect.height >= page.height * 0.06,
  );

const addFigures = (
  page: ExtractedPage,
  drafts: DraftBlock[],
  images: GraphicRegion[],
  bodyFontSize: number,
): ReflowBlock[] => {
  const consumedCaptions = new Set<DraftBlock>();
  const figures: Array<{
    figure: ReflowBlock;
    insertY: number;
    column: Column;
  }> = [];

  images.forEach((image, imageIndex) => {
    const caption = drafts
      .filter(
        (draft) => draft.kind === "caption" && !consumedCaptions.has(draft),
      )
      .map((draft) => ({
        draft,
        distance: Math.min(
          Math.abs(draft.firstY - rectBottom(image.rect)),
          Math.abs(
            image.rect.y -
              rectBottom(unionRects(draft.lines.map((line) => line.rect))),
          ),
        ),
      }))
      .filter((candidate) => candidate.distance <= page.height * 0.12)
      .sort((a, b) => a.distance - b.distance)[0]?.draft;
    if (caption) consumedCaptions.add(caption);
    const captionItems = caption?.lines.flatMap((line) => line.items) ?? [];
    const captionRect = caption
      ? unionRects(caption.lines.map((line) => line.rect))
      : null;
    const column: Column =
      image.rect.width > page.width * 0.58
        ? "full"
        : image.rect.x + image.rect.width / 2 < page.width / 2
        ? "left"
        : "right";
    figures.push({
      insertY: image.rect.y,
      column,
      figure: {
        id: `p${page.pageNumber}-figure${imageIndex}`,
        kind: "figure",
        caption: caption?.text ?? null,
        crop: image.rect,
        anchor: anchorForItems(
          page,
          captionItems,
          caption?.text ?? "",
          captionRect ? [image.rect, captionRect] : [image.rect],
        ),
      },
    });
  });

  const entries: Array<
    | { kind: "draft"; draft: DraftBlock }
    | { kind: "figure"; figure: ReflowBlock }
  > = drafts
    .filter((draft) => !consumedCaptions.has(draft))
    .map((draft) => ({ kind: "draft", draft }));

  for (const { figure, insertY, column } of figures) {
    let insertion = entries.findIndex(
      (entry) =>
        entry.kind === "draft" &&
        (entry.draft.column === column || entry.draft.column === "full") &&
        entry.draft.firstY > insertY,
    );
    if (insertion < 0) insertion = entries.length;
    entries.splice(insertion, 0, { kind: "figure", figure });
  }

  return entries.map((entry, index) =>
    entry.kind === "figure"
      ? entry.figure
      : blockFromDraft(page, entry.draft, bodyFontSize, index),
  );
};

const baseDiagnostics = (
  page: ExtractedPage,
  values: Partial<
    Pick<
      PageDiagnostics,
      | "detectedColumns"
      | "bodyFontSize"
      | "lineCount"
      | "blockCount"
      | "largeImageCount"
      | "tableRowCount"
      | "equationLineCount"
    >
  > = {},
): PageDiagnostics => ({
  ...page.diagnostics,
  characterCount: normalizeWhitespace(page.pageText).length,
  detectedColumns: values.detectedColumns ?? 0,
  bodyFontSize: values.bodyFontSize ?? null,
  lineCount: values.lineCount ?? 0,
  blockCount: values.blockCount ?? 0,
  largeImageCount: values.largeImageCount ?? 0,
  tableRowCount: values.tableRowCount ?? 0,
  equationLineCount: values.equationLineCount ?? 0,
});

const fallback = (
  page: ExtractedPage,
  reason: PageFallbackReason,
  diagnostics: PageDiagnostics,
): ReflowPage => ({
  kind: "fallback",
  pageNumber: page.pageNumber,
  width: page.width,
  height: page.height,
  reason,
  anchor: fullPageAnchor(page),
  diagnostics,
});

export const reconstructPage = (page: ExtractedPage): ReflowPage => {
  const characterCount = normalizeWhitespace(page.pageText).length;
  if (page.items.length === 0 || characterCount === 0) {
    return fallback(page, "no-text-layer", baseDiagnostics(page));
  }
  if (characterCount < 36) {
    return fallback(page, "too-little-text", baseDiagnostics(page));
  }
  const unsupportedDirectionCharacters = page.items
    .filter((item) => item.direction !== "ltr")
    .reduce((sum, item) => sum + item.str.length, 0);
  if (unsupportedDirectionCharacters / Math.max(1, characterCount) > 0.04) {
    return fallback(
      page,
      "unsupported-writing-direction",
      baseDiagnostics(page),
    );
  }

  const initialLines = makeInitialLines(page);
  const bodyFontSize = median(
    initialLines
      .filter((line) => line.text.length >= 24)
      .map((line) => line.fontSize),
  );
  const effectiveBodyFontSize =
    bodyFontSize || median(initialLines.map((line) => line.fontSize));
  const columns = detectColumns(initialLines, page.width);
  const tableRowCount = detectTableRows(initialLines, effectiveBodyFontSize);
  const equationLineCount = countEquationLines(initialLines);
  const images = largeImages(page);
  const diagnosticValues = {
    detectedColumns: columns.count,
    bodyFontSize: effectiveBodyFontSize,
    lineCount: initialLines.length,
    largeImageCount: images.length,
    tableRowCount,
    equationLineCount,
  } satisfies Partial<PageDiagnostics>;

  if (hasCorruptFontMapping(initialLines, page.items)) {
    return fallback(
      page,
      "corrupt-font-mapping",
      baseDiagnostics(page, diagnosticValues),
    );
  }
  const hasTableStructure = page.diagnostics.structTreeRoles.includes("Table");
  if (hasTableStructure || tableRowCount >= 5) {
    return fallback(
      page,
      "table-grid",
      baseDiagnostics(page, diagnosticValues),
    );
  }
  const equationRatio = equationLineCount / Math.max(1, initialLines.length);
  if (
    (equationLineCount >= 4 && equationRatio >= 0.12) ||
    (equationLineCount >= 8 && equationRatio >= 0.06)
  ) {
    return fallback(
      page,
      "equation-dense",
      baseDiagnostics(page, diagnosticValues),
    );
  }
  if (page.diagnostics.vectorPaintCount >= 90 && characterCount < 700) {
    return fallback(
      page,
      "vector-heavy",
      baseDiagnostics(page, diagnosticValues),
    );
  }
  if (initialLines.length === 0 || effectiveBodyFontSize <= 0) {
    return fallback(
      page,
      "layout-ambiguous",
      baseDiagnostics(page, diagnosticValues),
    );
  }

  const orderedLines = orderLines(initialLines, page.width, columns);
  const drafts = buildDraftBlocks(orderedLines, effectiveBodyFontSize, page);
  const readingOrderDrafts = [
    ...drafts.filter((draft) => draft.kind !== "footnote"),
    ...drafts.filter((draft) => draft.kind === "footnote"),
  ];
  const blocks = addFigures(
    page,
    readingOrderDrafts,
    images,
    effectiveBodyFontSize,
  );
  if (blocks.length === 0) {
    return fallback(
      page,
      "layout-ambiguous",
      baseDiagnostics(page, diagnosticValues),
    );
  }
  return {
    kind: "reflowed",
    pageNumber: page.pageNumber,
    width: page.width,
    height: page.height,
    blocks,
    diagnostics: baseDiagnostics(page, {
      ...diagnosticValues,
      blockCount: blocks.length,
    }),
  };
};

export const reconstructDocument = (pages: ExtractedPage[]): ReflowDocument => {
  const reconstructed = pages.map(reconstructPage);
  const supportedPageCount = reconstructed.filter(
    (page) => page.kind === "reflowed",
  ).length;
  const fallbackPageCount = reconstructed.length - supportedPageCount;
  const supportedRatio = supportedPageCount / Math.max(1, reconstructed.length);
  const qualification =
    supportedPageCount === 0
      ? "unsupported"
      : supportedRatio >= 0.6
      ? "supported"
      : "mixed";
  return {
    qualification,
    pages: reconstructed,
    supportedPageCount,
    fallbackPageCount,
  };
};

export const findBlockNearestPoint = (
  document: ReflowDocument,
  pageNumber: number,
  pageY: number,
): ReflowBlock | null => {
  const page = document.pages.find(
    (candidate) => candidate.pageNumber === pageNumber,
  );
  if (!page || page.kind === "fallback") return null;
  return (
    [...page.blocks].sort((a, b) => {
      const aRect = a.anchor.boundingRect;
      const bRect = b.anchor.boundingRect;
      const aDistance =
        pageY < aRect.y
          ? aRect.y - pageY
          : pageY > rectBottom(aRect)
          ? pageY - rectBottom(aRect)
          : 0;
      const bDistance =
        pageY < bRect.y
          ? bRect.y - pageY
          : pageY > rectBottom(bRect)
          ? pageY - rectBottom(bRect)
          : 0;
      return aDistance - bDistance;
    })[0] ?? null
  );
};

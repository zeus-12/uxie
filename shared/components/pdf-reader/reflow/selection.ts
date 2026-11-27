import type { PDFPageProxy } from "pdfjs-dist";
import { renderTextLayer } from "pdfjs-dist/legacy/build/pdf";
import { viewportToScaled } from "react-pdf-highlighter/dist/esm/lib/coordinates";
import getBoundingRect from "react-pdf-highlighter/dist/esm/lib/get-bounding-rect";
import getClientRects from "react-pdf-highlighter/dist/esm/lib/get-client-rects";
import optimizeClientRects from "react-pdf-highlighter/dist/esm/lib/optimize-client-rects";
import type { LTWHP, ScaledPosition } from "react-pdf-highlighter";
import type { ItemRange } from "../../../lib/reflow/anchors";
import type { PageInput } from "../../../lib/reflow/types";

// runStart/runEnd: the part of the item its run shows (reflow hides e.g. a
// line-end hyphen it joined).
export type RunSlice = {
  pageNumber: number;
  itemIndex: number;
  from: number;
  to: number;
  runStart?: number;
  runEnd?: number;
};

export type ReflowSelection = {
  text: string;
  start: { pageNumber: number; blockIndex: number; offsetInBlock: number };
  ranges: Map<number, ItemRange[]>;
  resolvePosition: () => Promise<ScaledPosition | null>;
};

const runOf = (el: Element) => {
  const [page, item] = (el.getAttribute("data-run") ?? "").split(":").map(Number);
  return { pageNumber: page!, itemIndex: item!, start: Number(el.getAttribute("data-run-start")) };
};

const textBefore = (container: Element, node: Node, offset: number) => {
  const r = document.createRange();
  r.setStart(container, 0);
  r.setEnd(node, offset);
  return r.toString().length;
};

// Each run shows str.slice(start, end) of one pdf.js text item, so a DOM point
// inside it is an exact item offset; points between runs snap to the next one.
export const selectedSlices = (root: Element, range: Range): RunSlice[] => {
  const slices: RunSlice[] = [];
  for (const el of root.querySelectorAll<HTMLElement>("[data-run]")) {
    if (!range.intersectsNode(el)) continue;
    const { pageNumber, itemIndex, start } = runOf(el);
    const length = el.textContent?.length ?? 0;
    const from = el.contains(range.startContainer)
      ? textBefore(el, range.startContainer, range.startOffset)
      : 0;
    const to = el.contains(range.endContainer) ? textBefore(el, range.endContainer, range.endOffset) : length;
    if (to > from) {
      slices.push({
        pageNumber,
        itemIndex,
        from: start + from,
        to: start + to,
        runStart: start,
        runEnd: start + length,
      });
    }
  }
  return slices;
};

type PageLayer = { node: HTMLElement; number: number; textDivs: HTMLElement[] };

const renderPageLayer = async (pdfPage: PDFPageProxy, scale: number, host: HTMLElement): Promise<PageLayer> => {
  const viewport = pdfPage.getViewport({ scale });
  const node = document.createElement("div");
  node.className = "textLayer";
  Object.assign(node.style, { position: "relative", width: `${viewport.width}px`, height: `${viewport.height}px` });
  host.appendChild(node);
  const textDivs: HTMLElement[] = [];
  const itemsStr: string[] = [];

  await renderTextLayer({
    textContent: await pdfPage.getTextContent(),
    container: node,
    viewport,
    textDivs,
    textContentItemsStr: itemsStr,
  }).promise;
  return { node, number: pdfPage.pageNumber, textDivs };
};

const pointIn = (div: HTMLElement, offset: number) => {
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  let left = offset;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = (n as Text).length;
    if (left <= len) return { node: n, offset: left };
    left -= len;
  }
  return { node: div, offset: div.childNodes.length };
};

// pdf.js's text layer only puts a span in the DOM for a non-empty item.
const blockIndexOf = (itemsStr: string[], itemIndex: number) =>
  itemsStr.slice(0, itemIndex).filter((s) => s !== "").length;


// Adds the whitespace items between two adjacent slices, as the page's text
// layer selection would; a jump to another page or a reordered item is a gap.
type Covered = { slices: RunSlice[]; quote: string };

const coverSelection = (slices: RunSlice[], inputOf: (pageNumber: number) => PageInput | undefined): Covered | null => {
  const covered: RunSlice[] = [];
  let quote = "";
  const continues = (a: RunSlice, b: RunSlice | undefined) =>
    !!b && b.pageNumber === a.pageNumber && b.itemIndex > a.itemIndex;
  for (let k = 0; k < slices.length; k++) {
    const input = inputOf(slices[k]!.pageNumber);
    if (!input) return null;
    const cur = { ...slices[k]! };
    const length = (input.itemStrings[cur.itemIndex] ?? "").length;
    if (continues(cur, slices[k + 1]) && cur.to === cur.runEnd) cur.to = length;
    const prev = slices[k - 1];
    if (prev && continues(prev, cur) && cur.from === cur.runStart) cur.from = 0;
    const eol = new Set(input.items.filter((i) => i.hasEOL).map((i) => i.index));
    covered.push(cur);
    quote += (input.itemStrings[cur.itemIndex] ?? "").slice(cur.from, cur.to);
    const next = slices[k + 1];
    if (!next) break;
    if (next.pageNumber !== cur.pageNumber || next.itemIndex <= cur.itemIndex) {
      quote += next.itemIndex === cur.itemIndex && next.pageNumber === cur.pageNumber ? "" : " ";
      continue;
    }
    if (eol.has(cur.itemIndex)) quote += "\n";
    for (let j = cur.itemIndex + 1; j < next.itemIndex; j++) {
      const str = input.itemStrings[j] ?? "";
      if (str.trim() === "") {
        if (str) covered.push({ pageNumber: cur.pageNumber, itemIndex: j, from: 0, to: str.length });
        quote += str;
      } else {
        quote += " ";
      }
      if (eol.has(j)) quote += "\n";
    }
  }
  return { slices: covered, quote: quote.split("\n").join(" ") };
};

export const selectionQuote = (slices: RunSlice[], inputOf: (pageNumber: number) => PageInput | undefined) =>
  coverSelection(slices, inputOf)?.quote ?? null;

// Lays out pdf.js's own text layer for each page at the viewer's scale and asks
// react-pdf-highlighter for the rects of the same characters, as a page selection does.
const selectionPosition = async (
  slices: RunSlice[],
  getPage: (pageNumber: number) => Promise<PDFPageProxy>,
  scale: number,
): Promise<ScaledPosition | null> => {
  const pageNumbers = [...new Set(slices.map((s) => s.pageNumber))].sort((a, b) => a - b);
  const host = document.createElement("div");
  Object.assign(host.style, { position: "fixed", left: "-100000px", top: "0", visibility: "hidden" });
  document.body.appendChild(host);
  try {
    const pages = await Promise.all(
      pageNumbers.map(async (n) => renderPageLayer(await getPage(n), scale, host)),
    );
    const rects: LTWHP[] = [];
    const byNumber = new Map(pages.map((p) => [p.number, p]));
    for (const slice of slices) {
      const page = byNumber.get(slice.pageNumber);
      const div = page?.textDivs[slice.itemIndex];
      if (!page || !div) return null;
      const range = document.createRange();
      const s = pointIn(div, slice.from);
      const e = pointIn(div, slice.to);
      range.setStart(s.node, s.offset);
      range.setEnd(e.node, e.offset);
      rects.push(...getClientRects(range, [{ node: page.node, number: page.number }], false));
    }
    if (rects.length === 0) return null;
    const optimized = optimizeClientRects(rects);
    const firstPage = pages[0]!;
    const size = { width: firstPage.node.offsetWidth, height: firstPage.node.offsetHeight };
    return {
      boundingRect: viewportToScaled(getBoundingRect(optimized), size),
      rects: optimized.map((r) => viewportToScaled(r, size)),
      pageNumber: firstPage.number,
    };
  } finally {
    host.remove();
  }
};

export const describeSelection = (
  slices: RunSlice[],
  inputOf: (pageNumber: number) => PageInput | undefined,
  getPage: (pageNumber: number) => Promise<PDFPageProxy>,
  scale: number,
): ReflowSelection | null => {
  const first = slices[0];
  const covered = coverSelection(slices, inputOf);
  const firstInput = first && inputOf(first.pageNumber);
  if (!first || !covered || !firstInput) return null;
  const ranges = new Map<number, ItemRange[]>();
  for (const slice of covered.slices) {
    const list = ranges.get(slice.pageNumber) ?? [];
    list.push({ begin: { itemIndex: slice.itemIndex, offset: slice.from }, end: { itemIndex: slice.itemIndex, offset: slice.to } });
    ranges.set(slice.pageNumber, list);
  }
  return {
    text: covered.quote,
    start: {
      pageNumber: first.pageNumber,
      blockIndex: blockIndexOf(firstInput.itemStrings, first.itemIndex),
      offsetInBlock: first.from,
    },
    ranges,
    resolvePosition: () => selectionPosition(covered.slices, getPage, scale),
  };
};

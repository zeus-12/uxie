import type { PDFPageProxy } from "pdfjs-dist";
import { renderTextLayer } from "pdfjs-dist/legacy/build/pdf";
import { viewportToScaled } from "react-pdf-highlighter/dist/esm/lib/coordinates";
import getBoundingRect from "react-pdf-highlighter/dist/esm/lib/get-bounding-rect";
import getClientRects from "react-pdf-highlighter/dist/esm/lib/get-client-rects";
import optimizeClientRects from "react-pdf-highlighter/dist/esm/lib/optimize-client-rects";
import type { LTWHP, ScaledPosition } from "react-pdf-highlighter";
import type { ItemRange } from "../../../lib/reflow/anchors";
import type { PageInput } from "../../../lib/reflow/types";

export type RunSlice = { pageNumber: number; itemIndex: number; from: number; to: number };

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
    if (to > from) slices.push({ pageNumber, itemIndex, from: start + from, to: start + to });
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

const pageBounds = (slices: RunSlice[], pageNumber: number) => {
  const onPage = slices.filter((s) => s.pageNumber === pageNumber);
  const first = onPage.reduce((a, b) => (b.itemIndex < a.itemIndex || (b.itemIndex === a.itemIndex && b.from < a.from) ? b : a));
  const last = onPage.reduce((a, b) => (b.itemIndex > a.itemIndex || (b.itemIndex === a.itemIndex && b.to > a.to) ? b : a));
  return { first, last };
};

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
    for (const page of pages) {
      const { first, last } = pageBounds(slices, page.number);
      const startDiv = page.textDivs[first.itemIndex];
      const endDiv = page.textDivs[last.itemIndex];
      if (!startDiv || !endDiv) return null;
      const range = document.createRange();
      const s = pointIn(startDiv, first.from);
      const e = pointIn(endDiv, last.to);
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

// The quote react-pdf-highlighter stores is Selection.toString() over the text
// layer with "\n" → " ": pdf.js puts a <br> after each item marked hasEOL.
export const selectionQuote = (slices: RunSlice[], inputOf: (pageNumber: number) => PageInput | undefined) => {
  const pageNumbers = [...new Set(slices.map((s) => s.pageNumber))].sort((a, b) => a - b);
  const parts: string[] = [];
  for (const pageNumber of pageNumbers) {
    const input = inputOf(pageNumber);
    if (!input) return null;
    const eol = new Set(input.items.filter((i) => i.hasEOL).map((i) => i.index));
    const { first, last } = pageBounds(slices, pageNumber);
    let text = "";
    for (let i = first.itemIndex; i <= last.itemIndex; i++) {
      const str = input.itemStrings[i] ?? "";
      text += str.slice(i === first.itemIndex ? first.from : 0, i === last.itemIndex ? last.to : str.length);
      if (i < last.itemIndex && eol.has(i)) text += "\n";
    }
    parts.push(text);
  }
  return parts.join(" ").split("\n").join(" ");
};

export const describeSelection = (
  slices: RunSlice[],
  inputOf: (pageNumber: number) => PageInput | undefined,
  getPage: (pageNumber: number) => Promise<PDFPageProxy>,
  scale: number,
): ReflowSelection | null => {
  if (slices.length === 0) return null;
  const text = selectionQuote(slices, inputOf);
  const firstPage = Math.min(...slices.map((s) => s.pageNumber));
  const firstInput = inputOf(firstPage);
  if (text === null || !firstInput) return null;
  const ranges = new Map<number, ItemRange[]>();
  for (const pageNumber of new Set(slices.map((s) => s.pageNumber))) {
    const { first, last } = pageBounds(slices, pageNumber);
    ranges.set(pageNumber, [
      { begin: { itemIndex: first.itemIndex, offset: first.from }, end: { itemIndex: last.itemIndex, offset: last.to } },
    ]);
  }
  const { first } = pageBounds(slices, firstPage);
  return {
    text,
    start: {
      pageNumber: firstPage,
      blockIndex: blockIndexOf(firstInput.itemStrings, first.itemIndex),
      offsetInBlock: first.from,
    },
    ranges,
    resolvePosition: () => selectionPosition(slices, getPage, scale),
  };
};

import type { PDFPageProxy } from "pdfjs-dist";
import { renderTextLayer } from "pdfjs-dist/legacy/build/pdf";
import { viewportToScaled } from "react-pdf-highlighter/dist/esm/lib/coordinates";
import getBoundingRect from "react-pdf-highlighter/dist/esm/lib/get-bounding-rect";
import getClientRects from "react-pdf-highlighter/dist/esm/lib/get-client-rects";
import optimizeClientRects from "react-pdf-highlighter/dist/esm/lib/optimize-client-rects";
import type { LTWHP, ScaledPosition } from "react-pdf-highlighter";
import type { ItemRange } from "../../../lib/reflow/anchors";

export type RunSlice = { pageNumber: number; itemIndex: number; from: number; to: number };

export type ReflowSelection = {
  position: ScaledPosition;
  text: string;
  start: { pageNumber: number; blockIndex: number; offsetInBlock: number };
  ranges: Map<number, ItemRange[]>;
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

type PageLayer = { node: HTMLElement; number: number; textDivs: HTMLElement[]; itemsStr: string[] };

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
  return { node, number: pdfPage.pageNumber, textDivs, itemsStr };
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

// The quote react-pdf-highlighter stores: Selection.toString() (pdf.js's <br>
// line breaks and page boundaries become "\n", which Range.toString() drops) with "\n" → " ".
const selectionText = (range: Range) => {
  const root = range.commonAncestorContainer;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let out = "";
  for (let n: Node | null = root.nodeType === Node.TEXT_NODE ? root : walker.nextNode(); n; n = walker.nextNode()) {
    if (!range.intersectsNode(n)) continue;
    if (n.nodeType === Node.TEXT_NODE) {
      const data = (n as Text).data;
      const from = n === range.startContainer ? range.startOffset : 0;
      const to = n === range.endContainer ? range.endOffset : data.length;
      out += data.slice(from, to);
    } else if ((n as Element).tagName === "BR") {
      out += "\n";
    }
    if (n === root) break;
  }
  return out.split("\n").join(" ");
};

// pdf.js's text layer only puts a span in the DOM for a non-empty item.
const blockIndexOf = (itemsStr: string[], itemIndex: number) =>
  itemsStr.slice(0, itemIndex).filter((s) => s !== "").length;

// Lays out pdf.js's own text layer for each page at the viewer's scale and asks
// react-pdf-highlighter for the rects of the same characters, as a page selection does.
export const selectionToPosition = async (
  slices: RunSlice[],
  getPage: (pageNumber: number) => Promise<PDFPageProxy>,
  scale: number,
): Promise<ReflowSelection | null> => {
  if (slices.length === 0) return null;
  const pageNumbers = [...new Set(slices.map((s) => s.pageNumber))].sort((a, b) => a - b);
  const host = document.createElement("div");
  Object.assign(host.style, { position: "fixed", left: "-100000px", top: "0", visibility: "hidden" });
  document.body.appendChild(host);
  try {
    const pages = await Promise.all(
      pageNumbers.map(async (n) => renderPageLayer(await getPage(n), scale, host)),
    );
    const rects: LTWHP[] = [];
    let text = "";
    const ranges = new Map<number, ItemRange[]>();
    const bounds = (n: number) => {
      const onPage = slices.filter((s) => s.pageNumber === n);
      const first = onPage.reduce((a, b) => (b.itemIndex < a.itemIndex || (b.itemIndex === a.itemIndex && b.from < a.from) ? b : a));
      const last = onPage.reduce((a, b) => (b.itemIndex > a.itemIndex || (b.itemIndex === a.itemIndex && b.to > a.to) ? b : a));
      return { first, last };
    };
    for (const page of pages) {
      const { first, last } = bounds(page.number);
      const startDiv = page.textDivs[first.itemIndex];
      const endDiv = page.textDivs[last.itemIndex];
      if (!startDiv || !endDiv) return null;
      const range = document.createRange();
      const s = pointIn(startDiv, first.from);
      const e = pointIn(endDiv, last.to);
      range.setStart(s.node, s.offset);
      range.setEnd(e.node, e.offset);
      rects.push(...getClientRects(range, [{ node: page.node, number: page.number }], false));
      text += (text ? " " : "") + selectionText(range);
      ranges.set(page.number, [
        { begin: { itemIndex: first.itemIndex, offset: first.from }, end: { itemIndex: last.itemIndex, offset: last.to } },
      ]);
    }
    if (rects.length === 0) return null;
    const optimized = optimizeClientRects(rects);
    const firstPage = pages[0]!;
    const size = { width: firstPage.node.offsetWidth, height: firstPage.node.offsetHeight };
    const firstSlice = bounds(firstPage.number).first;
    return {
      position: {
        boundingRect: viewportToScaled(getBoundingRect(optimized), size),
        rects: optimized.map((r) => viewportToScaled(r, size)),
        pageNumber: firstPage.number,
      },
      text,
      start: {
        pageNumber: firstPage.number,
        blockIndex: blockIndexOf(firstPage.itemsStr, firstSlice.itemIndex),
        offsetInBlock: firstSlice.from,
      },
      ranges,
    };
  } finally {
    host.remove();
  }
};

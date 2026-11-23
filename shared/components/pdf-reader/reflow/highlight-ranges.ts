import { renderTextLayer, type PDFPageProxy } from "pdfjs-dist";
import type { ItemRange } from "../../../lib/reflow/anchors";
import type { Rect } from "../../../lib/reflow/types";

const contains = (rects: Rect[], x: number, y: number) =>
  rects.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);

// Lays the page's text out with pdf.js's own text layer (the layout a highlight
// was selected on) and keeps the characters whose centres fall inside its rects.
export const highlightRanges = async (
  pdfPage: PDFPageProxy,
  rects: Rect[],
): Promise<ItemRange[]> => {
  if (rects.length === 0) return [];
  const viewport = pdfPage.getViewport({ scale: 1 });
  const container = document.createElement("div");
  container.className = "textLayer";
  Object.assign(container.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${viewport.width}px`,
    height: `${viewport.height}px`,
    visibility: "hidden",
  });
  document.body.appendChild(container);
  try {
    const textDivs: HTMLElement[] = [];
    const textContentItemsStr: string[] = [];
    await renderTextLayer({
      textContent: await pdfPage.getTextContent(),
      container,
      viewport,
      textDivs,
      textContentItemsStr,
    }).promise;
    if (textDivs.length !== textContentItemsStr.length) return [];
    const origin = container.getBoundingClientRect();
    const range = document.createRange();
    const out: ItemRange[] = [];
    textDivs.forEach((div, itemIndex) => {
      const node = div.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) return;
      const length = (node as Text).length;
      let open: number | null = null;
      for (let c = 0; c <= length; c++) {
        let inside = false;
        if (c < length) {
          range.setStart(node, c);
          range.setEnd(node, c + 1);
          const r = range.getBoundingClientRect();
          inside =
            r.width > 0 &&
            contains(rects, r.left + r.width / 2 - origin.left, r.top + r.height / 2 - origin.top);
        }
        if (inside && open === null) open = c;
        if (!inside && open !== null) {
          out.push({ begin: { itemIndex, offset: open }, end: { itemIndex, offset: c } });
          open = null;
        }
      }
    });
    return out;
  } finally {
    container.remove();
  }
};

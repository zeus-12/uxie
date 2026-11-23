import type { PDFPageProxy } from "pdfjs-dist";
import { renderTextLayer } from "pdfjs-dist/legacy/build/pdf";
import type { ItemRange } from "../../../lib/reflow/anchors";
import type { Rect } from "../../../lib/reflow/types";

const contains = (rects: Rect[], x: number, y: number) =>
  rects.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);

// Lays the page's text out with pdf.js's own text layer (the layout a highlight
// was selected on) and keeps the characters whose centres fall inside its rects.
export const highlightRanges = async (
  pdfPage: PDFPageProxy,
  groups: Rect[][],
): Promise<ItemRange[][]> => {
  if (groups.every((rects) => rects.length === 0)) return groups.map(() => []);
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
    if (textDivs.length !== textContentItemsStr.length) return groups.map(() => []);
    const origin = container.getBoundingClientRect();
    const range = document.createRange();
    const out: ItemRange[][] = groups.map(() => []);
    textDivs.forEach((div, itemIndex) => {
      const node = div.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) return;
      const length = (node as Text).length;
      const open: Array<number | null> = groups.map(() => null);
      for (let c = 0; c <= length; c++) {
        let centre: { x: number; y: number } | null = null;
        if (c < length) {
          range.setStart(node, c);
          range.setEnd(node, c + 1);
          const r = range.getBoundingClientRect();
          if (r.width > 0) centre = { x: r.left + r.width / 2 - origin.left, y: r.top + r.height / 2 - origin.top };
        }
        groups.forEach((rects, g) => {
          const inside = centre !== null && contains(rects, centre.x, centre.y);
          if (inside && open[g] === null) open[g] = c;
          if (!inside && open[g] !== null) {
            out[g]!.push({ begin: { itemIndex, offset: open[g]! }, end: { itemIndex, offset: c } });
            open[g] = null;
          }
        });
      }
    });
    return out;
  } finally {
    container.remove();
  }
};

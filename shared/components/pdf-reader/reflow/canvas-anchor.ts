import type { PDFViewer } from "pdfjs-dist/types/web/pdf_viewer";

export type PdfPoint = { pageNumber: number; x: number; y: number };

import { caretAt, offsetWithin } from "./caret";

export type CharAnchor = { itemIndex: number; offset: number };

export type ScreenAnchor = { point: PdfPoint; clientX: number; clientY: number; char?: CharAnchor };

type PageView = {
  div: HTMLElement;
  viewport: { scale: number; width: number };
  textLayer?: { textDivs?: HTMLElement[] } | null;
};

const pageView = (viewer: PDFViewer, index: number) =>
  viewer.getPageView(index) as unknown as PageView | undefined;

export const canvasPointAt = (
  viewer: PDFViewer,
  clientX: number,
  clientY: number,
): PdfPoint | null => {
  let best: { index: number; rect: DOMRect; distance: number } | null = null;
  for (let i = 0; i < viewer.pagesCount; i++) {
    const view = pageView(viewer, i);
    if (!view) continue;
    const rect = view.div.getBoundingClientRect();
    const distance =
      clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    if (!best || distance < best.distance) best = { index: i, rect, distance };
    if (distance === 0) break;
  }
  if (!best) return null;
  const scale = pageView(viewer, best.index)!.viewport.scale;
  const y = Math.min(Math.max(clientY, best.rect.top), best.rect.bottom);
  return {
    pageNumber: best.index + 1,
    x: (clientX - best.rect.left) / scale,
    y: (y - best.rect.top) / scale,
  };
};

export const canvasAnchorAt = (
  viewer: PDFViewer,
  clientX: number,
  clientY: number,
): ScreenAnchor | null => {
  const point = canvasPointAt(viewer, clientX, clientY);
  if (!point) return null;
  const anchor: ScreenAnchor = { point, clientX, clientY };
  const caret = caretAt(clientX, clientY);
  const divs = pageView(viewer, point.pageNumber - 1)?.textLayer?.textDivs;
  const host = caret?.node.parentElement?.closest<HTMLElement>(".textLayer > span, .textLayer span[role='presentation']");
  if (caret && divs && host) {
    const itemIndex = divs.indexOf(host);
    const offset = offsetWithin(host, caret);
    if (itemIndex >= 0 && offset !== null) anchor.char = { itemIndex, offset };
  }
  return anchor;
};

export const scrollCanvasTo = (viewer: PDFViewer, anchor: ScreenAnchor) => {
  const view = pageView(viewer, anchor.point.pageNumber - 1);
  if (!view) return;
  const rect = view.div.getBoundingClientRect();
  const scale = view.viewport.scale;
  const container = viewer.container;
  container.scrollTop += rect.top + anchor.point.y * scale - anchor.clientY;
  container.scrollLeft += rect.left + anchor.point.x * scale - anchor.clientX;
};

export const fitWidthScale = (viewer: PDFViewer): number | null => {
  const view = pageView(viewer, Math.max(0, viewer.currentPageNumber - 1));
  if (!view || !viewer.currentScale) return null;
  const unscaledWidth = view.viewport.width / viewer.currentScale;
  return unscaledWidth > 0 ? viewer.container.clientWidth / unscaledWidth : null;
};

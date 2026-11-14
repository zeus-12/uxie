import { findExactPdfTextRange } from "./pdf-text-layer";

const LAYER_CLASS = "citation-hl-layer";
const HIGHLIGHT_CLASS = "citation-hl-source";

export function clearCitationHighlights(): void {
  document
    .querySelectorAll(`.${HIGHLIGHT_CLASS}`)
    .forEach((item) => item.remove());
}

function getLayer(page: Element): HTMLElement {
  const existing = page.querySelector<HTMLElement>(`.${LAYER_CLASS}`);
  if (existing) return existing;

  const layer = document.createElement("div");
  layer.className = LAYER_CLASS;
  page.appendChild(layer);
  return layer;
}

/** Paints the complete exact chunk and returns the first band for centering. */
export function paintCitationHighlight(
  pageNumber: number,
  pageContent: string,
): HTMLElement | null {
  const page = document.querySelector(
    `.page[data-page-number="${pageNumber}"]`,
  );
  if (!page) return null;

  const range = findExactPdfTextRange(page, pageContent);
  if (!range) return null;

  clearCitationHighlights();
  const layer = getLayer(page);
  const origin = layer.getBoundingClientRect();
  let first: HTMLElement | null = null;

  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width < 0.5 || rect.height < 0.5) continue;
    const highlight = document.createElement("div");
    highlight.className = HIGHLIGHT_CLASS;
    highlight.setAttribute("data-citation-text", range.toString());
    highlight.style.left = `${rect.left - origin.left - 2}px`;
    highlight.style.top = `${rect.top - origin.top}px`;
    highlight.style.width = `${rect.width + 4}px`;
    highlight.style.height = `${rect.height}px`;
    layer.appendChild(highlight);
    first ??= highlight;
  }
  return first;
}

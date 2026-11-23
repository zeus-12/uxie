import { findExactPdfTextRange, mergeRectsByLine } from "./pdf-text-layer";

const LAYER_CLASS = "citation-hl-layer";
const HIGHLIGHT_CLASS = "citation-hl-source";
const SVG_NS = "http://www.w3.org/2000/svg";

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

// One path for the whole passage: bands of adjacent lines overlap vertically,
// and as a single nonzero fill every point is painted exactly once.
export function paintCitationHighlight(
  pageNumber: number,
  pageContent: string,
): SVGPathElement | null {
  const page = document.querySelector(
    `.page[data-page-number="${pageNumber}"]`,
  );
  if (!page) return null;

  const range = findExactPdfTextRange(page, pageContent);
  if (!range) return null;

  const bands = mergeRectsByLine(range.getClientRects());
  if (bands.length === 0) return null;

  clearCitationHighlights();
  const layer = getLayer(page);
  const origin = layer.getBoundingClientRect();
  const d = bands
    .map((band) => {
      const x = band.left - origin.left - 2;
      const y = band.top - origin.top;
      return `M${x} ${y}h${band.width + 4}v${band.height}h${-(
        band.width + 4
      )}Z`;
    })
    .join("");

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", HIGHLIGHT_CLASS);
  svg.setAttribute("data-citation-text", range.toString());
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  layer.appendChild(svg);
  return path;
}

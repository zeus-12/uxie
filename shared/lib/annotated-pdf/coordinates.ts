export interface ScaledPdfRect {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  pageNumber?: number | null;
}

export interface PdfViewport {
  width: number;
  height: number;
  convertToPdfPoint: (x: number, y: number) => unknown;
}

export interface PdfRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

function finiteCoordinate(value: number | undefined, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`The highlight contains an invalid ${label}`);
  }
  return value;
}

function finitePoint(point: unknown): { x: number; y: number } {
  if (!Array.isArray(point)) {
    throw new Error("Unable to convert the highlight coordinates");
  }
  const [x, y] = point;
  if (typeof x !== "number" || !Number.isFinite(x)) {
    throw new Error("Unable to convert the highlight x-coordinate");
  }
  if (typeof y !== "number" || !Number.isFinite(y)) {
    throw new Error("Unable to convert the highlight y-coordinate");
  }
  return { x, y };
}

/**
 * Converts react-pdf-highlighter's stored, zoom-independent geometry back to
 * PDF user-space coordinates. The pdf.js viewport owns crop-box and rotation
 * handling, which keeps this conversion independent of the app and renderer.
 */
export function scaledRectToPdfRectangle(
  rect: ScaledPdfRect,
  viewport: PdfViewport,
): PdfRectangle {
  const x1 = finiteCoordinate(rect.x1, "left coordinate");
  const y1 = finiteCoordinate(rect.y1, "top coordinate");
  const x2 = finiteCoordinate(rect.x2, "right coordinate");
  const y2 = finiteCoordinate(rect.y2, "bottom coordinate");
  const storedWidth = finiteCoordinate(rect.width, "page width");
  const storedHeight = finiteCoordinate(rect.height, "page height");

  if (storedWidth <= 0 || storedHeight <= 0) {
    throw new Error("The highlight contains invalid page dimensions");
  }
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    throw new Error("The PDF page has invalid dimensions");
  }

  const left = (viewport.width * x1) / storedWidth;
  const top = (viewport.height * y1) / storedHeight;
  const right = (viewport.width * x2) / storedWidth;
  const bottom = (viewport.height * y2) / storedHeight;

  const first = finitePoint(viewport.convertToPdfPoint(left, top));
  const second = finitePoint(viewport.convertToPdfPoint(right, bottom));

  return {
    x: Math.min(first.x, second.x),
    y: Math.min(first.y, second.y),
    width: Math.abs(second.x - first.x),
    height: Math.abs(second.y - first.y),
  };
}

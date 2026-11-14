import { BlendMode, PDFDocument, type PDFPage, rgb } from "pdf-lib";
import {
  scaledRectToPdfRectangle,
  type PdfViewport,
  type ScaledPdfRect,
} from "./coordinates";

export type { PdfRectangle, PdfViewport, ScaledPdfRect } from "./coordinates";
export { scaledRectToPdfRectangle } from "./coordinates";

export interface AnnotatedPdfHighlight {
  position: {
    boundingRect?: ScaledPdfRect | null;
    rects?: ScaledPdfRect[] | null;
    pageNumber?: number | null;
  };
}

export interface PdfViewportDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => PdfViewport;
  }>;
}

// These are the exact colors used by react-pdf-highlighter's Highlight.css and
// AreaHighlight.css. Multiply keeps the original PDF text visible while making
// the exported fill look like the reader's layer on a white page.
export const ANNOTATED_PDF_STYLE = {
  textFill: [255, 226, 143] as const,
  areaFill: [252, 232, 151] as const,
  areaBorder: [51, 51, 51] as const,
};

export function annotatedPdfFilename(title: string | null): string {
  const withoutExtension = (title ?? "").replace(/\.pdf$/i, "");
  const safeTitle = withoutExtension
    .replace(/[\u0000-\u001f/:]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return `${safeTitle || "document"} annotated.pdf`;
}

function color([red, green, blue]: readonly [number, number, number]) {
  return rgb(red / 255, green / 255, blue / 255);
}

function pageNumberFor(
  highlight: AnnotatedPdfHighlight,
  rect: ScaledPdfRect,
): number {
  return (
    rect.pageNumber ??
    highlight.position.pageNumber ??
    highlight.position.boundingRect?.pageNumber ??
    1
  );
}

function assertPageNumber(pageNumber: number, pageCount: number): void {
  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > pageCount
  ) {
    throw new Error(`A highlight refers to missing page ${pageNumber}`);
  }
}

export async function createAnnotatedPdf(
  sourceBytes: Uint8Array,
  highlights: AnnotatedPdfHighlight[],
  options: { viewportDocument?: PdfViewportDocument } = {},
): Promise<Uint8Array> {
  const pdfDocument = await PDFDocument.load(sourceBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  let ownedPdfJsDocument:
    | (PdfViewportDocument & { destroy: () => Promise<void> })
    | undefined;
  let pdfJsDocument: PdfViewportDocument;
  if (options.viewportDocument) {
    pdfJsDocument = options.viewportDocument;
  } else {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf");
    const loadingTask = getDocument({ data: new Uint8Array(sourceBytes) });
    ownedPdfJsDocument = await loadingTask.promise;
    pdfJsDocument = ownedPdfJsDocument;
  }

  try {
    const pageCount = pdfDocument.getPageCount();
    if (pdfJsDocument.numPages !== pageCount) {
      throw new Error("The PDF page count changed while preparing the export");
    }

    const pages = new Map<
      number,
      { pdfPage: PDFPage; viewport: PdfViewport }
    >();

    async function getPage(pageNumber: number) {
      assertPageNumber(pageNumber, pageCount);
      const cached = pages.get(pageNumber);
      if (cached) return cached;

      const pdfJsPage = await pdfJsDocument.getPage(pageNumber);
      const page = {
        pdfPage: pdfDocument.getPage(pageNumber - 1),
        viewport: pdfJsPage.getViewport({ scale: 1 }),
      };
      pages.set(pageNumber, page);
      return page;
    }

    for (const highlight of highlights) {
      const rectangles = highlight.position.rects ?? [];
      if (rectangles.length > 0) {
        for (const rect of rectangles) {
          const pageNumber = pageNumberFor(highlight, rect);
          const { pdfPage, viewport } = await getPage(pageNumber);
          pdfPage.drawRectangle({
            ...scaledRectToPdfRectangle(rect, viewport),
            color: color(ANNOTATED_PDF_STYLE.textFill),
            blendMode: BlendMode.Multiply,
            opacity: 1,
          });
        }
        continue;
      }

      const rect = highlight.position.boundingRect;
      if (!rect) {
        throw new Error("An area highlight is missing its boundary");
      }
      const pageNumber = pageNumberFor(highlight, rect);
      const { pdfPage, viewport } = await getPage(pageNumber);
      pdfPage.drawRectangle({
        ...scaledRectToPdfRectangle(rect, viewport),
        color: color(ANNOTATED_PDF_STYLE.areaFill),
        borderColor: color(ANNOTATED_PDF_STYLE.areaBorder),
        borderOpacity: 1,
        borderWidth: 1,
        blendMode: BlendMode.Multiply,
        opacity: 1,
      });
    }

    return await pdfDocument.save();
  } finally {
    await ownedPdfJsDocument?.destroy();
  }
}

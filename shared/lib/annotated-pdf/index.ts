import {
  fill,
  PDFDocument,
  type PDFContext,
  type PDFOperator,
  type PDFRef,
  PDFString,
  rectangle,
  setFillingRgbColor,
  setGraphicsState,
} from "pdf-lib";
import {
  scaledRectToPdfRectangle,
  type PdfRectangle,
  type PdfViewport,
  type ScaledPdfRect,
} from "./coordinates";

export type { PdfRectangle, PdfViewport, ScaledPdfRect } from "./coordinates";
export { scaledRectToPdfRectangle } from "./coordinates";

export interface AnnotatedPdfHighlight {
  id: string;
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

type Rgb = readonly [number, number, number];

// The fill react-pdf-highlighter's .Highlight__part and .AreaHighlight__part paint, multiplied onto the page.
export const HIGHLIGHT_COLOR: Rgb = [255, 226, 143];

const PRINT_FLAG = 4;

export function annotatedPdfFilename(title: string | null): string {
  const withoutExtension = (title ?? "").replace(/\.pdf$/i, "");
  const safeTitle = withoutExtension
    .replace(/[\u0000-\u001f/:]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return `${safeTitle || "document"} annotated.pdf`;
}

function pageNumberFor(
  highlight: AnnotatedPdfHighlight,
  rect: ScaledPdfRect,
): number {
  const pageNumber =
    rect.pageNumber ??
    highlight.position.pageNumber ??
    highlight.position.boundingRect?.pageNumber;
  if (pageNumber == null) {
    throw new Error("A highlight is missing its page number");
  }
  return pageNumber;
}

function pdfColor([red, green, blue]: Rgb): [number, number, number] {
  return [red / 255, green / 255, blue / 255];
}

function union(rectangles: PdfRectangle[]): number[] {
  const left = Math.min(...rectangles.map((r) => r.x));
  const bottom = Math.min(...rectangles.map((r) => r.y));
  const right = Math.max(...rectangles.map((r) => r.x + r.width));
  const top = Math.max(...rectangles.map((r) => r.y + r.height));
  return [left, bottom, right, top];
}

function appearanceStream(
  context: PDFContext,
  bbox: number[],
  operators: PDFOperator[],
): PDFRef {
  const stream = context.formXObject(operators, {
    BBox: bbox,
    Resources: {
      ExtGState: { Multiply: { Type: "ExtGState", BM: "Multiply" } },
    },
  });
  return context.register(stream);
}

function textHighlightAnnotation(
  context: PDFContext,
  id: string,
  rectangles: PdfRectangle[],
): PDFRef {
  const color = pdfColor(HIGHLIGHT_COLOR);
  const bbox = union(rectangles);
  const appearance = appearanceStream(context, bbox, [
    setGraphicsState("Multiply"),
    setFillingRgbColor(...color),
    ...rectangles.map((r) => rectangle(r.x, r.y, r.width, r.height)),
    fill(),
  ]);
  return context.register(
    context.obj({
      Type: "Annot",
      Subtype: "Highlight",
      Rect: bbox,
      QuadPoints: rectangles.flatMap((r) => [
        r.x,
        r.y + r.height,
        r.x + r.width,
        r.y + r.height,
        r.x,
        r.y,
        r.x + r.width,
        r.y,
      ]),
      C: color,
      F: PRINT_FLAG,
      NM: PDFString.of(id),
      AP: { N: appearance },
    }),
  );
}

function areaHighlightAnnotation(
  context: PDFContext,
  id: string,
  area: PdfRectangle,
): PDFRef {
  const color = pdfColor(HIGHLIGHT_COLOR);
  const bbox = union([area]);
  const appearance = appearanceStream(context, bbox, [
    setGraphicsState("Multiply"),
    setFillingRgbColor(...color),
    rectangle(area.x, area.y, area.width, area.height),
    fill(),
  ]);
  return context.register(
    context.obj({
      Type: "Annot",
      Subtype: "Square",
      Rect: bbox,
      C: color,
      IC: color,
      BS: { W: 0 },
      F: PRINT_FLAG,
      NM: PDFString.of(id),
      AP: { N: appearance },
    }),
  );
}

export async function createAnnotatedPdf(
  sourceBytes: Uint8Array,
  highlights: AnnotatedPdfHighlight[],
  pdfJsDocument: PdfViewportDocument,
): Promise<Uint8Array> {
  const pdfDocument = await PDFDocument.load(sourceBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  if (pdfDocument.isEncrypted) {
    throw new Error("Encrypted PDFs can't be exported with annotations yet.");
  }

  const pageCount = pdfDocument.getPageCount();
  if (pdfJsDocument.numPages !== pageCount) {
    throw new Error("The PDF page count changed while preparing the export");
  }

  const viewports = new Map<number, PdfViewport>();
  async function viewportFor(pageNumber: number): Promise<PdfViewport> {
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > pageCount
    ) {
      throw new Error(`A highlight refers to missing page ${pageNumber}`);
    }
    const cached = viewports.get(pageNumber);
    if (cached) return cached;
    const page = await pdfJsDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    viewports.set(pageNumber, viewport);
    return viewport;
  }

  const addAnnotation = (pageNumber: number, ref: PDFRef) =>
    pdfDocument.getPage(pageNumber - 1).node.addAnnot(ref);

  for (const highlight of highlights) {
    const rects = highlight.position.rects ?? [];
    if (rects.length > 0) {
      const byPage = new Map<number, PdfRectangle[]>();
      for (const rect of rects) {
        const pageNumber = pageNumberFor(highlight, rect);
        const converted = scaledRectToPdfRectangle(
          rect,
          await viewportFor(pageNumber),
        );
        byPage.set(pageNumber, [...(byPage.get(pageNumber) ?? []), converted]);
      }
      for (const [pageNumber, rectangles] of byPage) {
        addAnnotation(
          pageNumber,
          textHighlightAnnotation(
            pdfDocument.context,
            highlight.id,
            rectangles,
          ),
        );
      }
      continue;
    }

    const rect = highlight.position.boundingRect;
    if (!rect) {
      throw new Error("An area highlight is missing its boundary");
    }
    const pageNumber = pageNumberFor(highlight, rect);
    addAnnotation(
      pageNumber,
      areaHighlightAnnotation(
        pdfDocument.context,
        highlight.id,
        scaledRectToPdfRectangle(rect, await viewportFor(pageNumber)),
      ),
    );
  }

  return pdfDocument.save();
}

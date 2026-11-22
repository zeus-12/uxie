import {
  annotatedPdfFilename,
  createAnnotatedPdf,
  type AnnotatedPdfHighlight,
  type PdfViewportDocument,
} from "@uxie/shared/lib/annotated-pdf";

export interface LoadedPdfForExport extends PdfViewportDocument {
  getData: () => Promise<Uint8Array>;
}

export async function prepareAnnotatedPdfDownload({
  highlights,
  pdfDocument,
  title,
}: {
  highlights: AnnotatedPdfHighlight[];
  pdfDocument: LoadedPdfForExport;
  title: string | null;
}): Promise<{ blob: Blob; filename: string }> {
  const sourceBytes = await pdfDocument.getData();
  const exportedBytes = await createAnnotatedPdf(
    sourceBytes,
    highlights,
    pdfDocument,
  );

  const blobBytes = new Uint8Array(exportedBytes.byteLength);
  blobBytes.set(exportedBytes);

  return {
    blob: new Blob([blobBytes.buffer], { type: "application/pdf" }),
    filename: annotatedPdfFilename(title),
  };
}

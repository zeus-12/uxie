import {
  prepareAnnotatedPdfDownload,
  type LoadedPdfForExport,
} from "@/lib/annotated-pdf-export";
import { type ReaderDoc } from "@/types/reader";
import { useAnnotatedPdfExport } from "@uxie/shared/components/workspace/annotated-pdf-export-menu-item";
import { saveAs } from "file-saver";

export interface AnnotatedPdfExportSource {
  pdfDocument: LoadedPdfForExport | null;
  readerDocument: Pick<ReaderDoc, "highlights" | "title">;
}

export function useAnnotatedPdfExportMenuItem(
  source: AnnotatedPdfExportSource | undefined,
) {
  const pdfDocument = source?.pdfDocument ?? null;
  const { isExporting, exportPdf } = useAnnotatedPdfExport(async () => {
    if (!source || !pdfDocument) return;
    const { blob, filename } = await prepareAnnotatedPdfDownload({
      highlights: source.readerDocument.highlights,
      pdfDocument,
      title: source.readerDocument.title,
    });
    saveAs(blob, filename);
  });

  return {
    ready: pdfDocument !== null,
    isExporting,
    onSelect: () => void exportPdf(),
  };
}

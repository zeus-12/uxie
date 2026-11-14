import {
  prepareAnnotatedPdfDownload,
  type LoadedPdfForExport,
} from "@/lib/annotated-pdf-export";
import { type ReaderDoc } from "@/types/reader";
import { DropdownMenuItem } from "@uxie/shared/components/ui/dropdown-menu";
import { saveAs } from "file-saver";
import { FileDown, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function AnnotatedPdfExportMenuItem({
  pdfDocument,
  readerDocument,
}: {
  pdfDocument: LoadedPdfForExport | null;
  readerDocument: Pick<ReaderDoc, "highlights" | "title">;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = async () => {
    if (!pdfDocument || isExporting) return;

    setIsExporting(true);
    try {
      const { blob, filename } = await prepareAnnotatedPdfDownload({
        highlights: readerDocument.highlights,
        pdfDocument,
        title: readerDocument.title,
      });
      saveAs(blob, filename);
      toast.success("Annotated PDF exported");
    } catch (error) {
      console.error("Unable to export annotated PDF", error);
      toast.error(
        "Unable to export annotated PDF. Reopen the document and try again.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenuItem
      className="cursor-pointer items-start gap-2"
      disabled={!pdfDocument || isExporting}
      onSelect={() => void exportPdf()}
    >
      {isExporting ? (
        <LoaderCircle className="mt-0.5 animate-spin" size={16} />
      ) : (
        <FileDown className="mt-0.5" size={16} />
      )}
      <span className="flex flex-col">
        <span>{isExporting ? "Exporting…" : "Export annotated PDF"}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {!pdfDocument
            ? "Available when the PDF finishes loading"
            : "Highlight notes aren’t included yet"}
        </span>
      </span>
    </DropdownMenuItem>
  );
}

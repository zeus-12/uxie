import { FileDown, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { DropdownMenuItem } from "../ui/dropdown-menu";
import { toast } from "../ui/sonner";

export function useAnnotatedPdfExport(onExport: () => Promise<void>) {
  const [isExporting, setIsExporting] = useState(false);
  const inFlight = useRef(false);

  const exportPdf = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsExporting(true);
    try {
      await onExport();
    } catch (error) {
      toast.error("Couldn't export the annotated PDF", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      inFlight.current = false;
      setIsExporting(false);
    }
  };

  return { isExporting, exportPdf };
}

export function AnnotatedPdfExportMenuItem({
  ready,
  isExporting,
  onSelect,
}: {
  ready: boolean;
  isExporting: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      className="cursor-pointer gap-2"
      disabled={!ready || isExporting}
      onSelect={onSelect}
    >
      {isExporting ? (
        <LoaderCircle className="animate-spin" size={16} />
      ) : (
        <FileDown size={16} />
      )}
      {isExporting ? "Exporting…" : "Export annotated PDF"}
    </DropdownMenuItem>
  );
}

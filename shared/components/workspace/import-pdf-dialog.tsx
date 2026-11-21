import { FileText, Loader2 } from "lucide-react";
import { useId } from "react";

import { ocrProgressLabel, type OcrProgress } from "../../lib/ocr";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { Switch } from "../ui/switch";

export interface PdfPreview {
  name: string;
  sizeBytes: number;
  pageCount: number | null;
  coverUrl: string | null;
}

export type ImportPhase =
  | { kind: "review" }
  | { kind: "ocr"; progress: OcrProgress }
  | { kind: "importing" };

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function ProgressBar({ progress }: { progress: OcrProgress }) {
  const pages = progress.kind === "recognizing" ? progress.pages : null;
  const fraction =
    pages && pages.total > 0 ? pages.completed / pages.total : null;

  return (
    <div className="mt-3 space-y-1.5" aria-live="polite">
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width] duration-300 ease-out",
            fraction === null && "w-full animate-pulse opacity-40",
          )}
          style={
            fraction === null ? undefined : { width: `${fraction * 100}%` }
          }
        />
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {ocrProgressLabel(progress)}
      </p>
    </div>
  );
}

export function ImportPdfDialog({
  preview,
  phase,
  ocr,
  onOcrChange,
  error,
  onImport,
  onCancel,
}: {
  preview: PdfPreview | null;
  phase: ImportPhase;
  ocr: boolean;
  onOcrChange: (ocr: boolean) => void;
  error: string | null;
  onImport: () => void;
  onCancel: () => void;
}) {
  const ocrId = useId();
  const busy = phase.kind !== "review";
  const title = preview?.name.replace(/\.pdf$/i, "") ?? "";

  return (
    <Dialog
      open={preview !== null}
      onOpenChange={(open) => !open && onCancel()}
    >
      <DialogContent hideClose className="max-w-md gap-0 overflow-hidden p-0">
        <div className="p-5">
          <DialogTitle className="text-base font-semibold">
            Import PDF
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review the file before adding it to your library.
          </DialogDescription>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-[104px] w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted shadow-sm">
              {preview?.coverUrl ? (
                <img
                  src={preview.coverUrl}
                  alt=""
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <FileText
                  aria-hidden="true"
                  className="h-6 w-6 text-muted-foreground"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="line-clamp-2 break-words font-medium leading-snug"
                title={title}
              >
                {title}
              </p>
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                {preview?.pageCount != null &&
                  `${preview.pageCount} ${
                    preview.pageCount === 1 ? "page" : "pages"
                  } · `}
                {preview && formatSize(preview.sizeBytes)}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <label htmlFor={ocrId} className="cursor-pointer">
              <span className="block text-sm font-medium">OCR</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Make scanned pages selectable and searchable.
              </span>
            </label>
            <Switch
              id={ocrId}
              checked={ocr}
              onCheckedChange={onOcrChange}
              disabled={busy}
              className="mt-0.5"
            />
          </div>
          {phase.kind === "ocr" && <ProgressBar progress={phase.progress} />}
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t bg-muted/40 px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={phase.kind === "importing"}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onImport}
            disabled={busy || preview?.pageCount == null}
            className="min-w-[88px]"
          >
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Importing
              </>
            ) : (
              "Import"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

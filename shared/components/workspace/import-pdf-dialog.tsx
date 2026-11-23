import { XIcon } from "lucide-react";
import { useState, type DragEvent } from "react";

import { ocrProgressLabel, type OcrProgress } from "../../lib/ocr";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Spinner } from "../ui/spinner";
import { OcrOption } from "./ocr-option";

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

function FileBox({
  preview,
  busy,
  onBrowse,
  onDropFile,
  onClear,
}: {
  preview: PdfPreview | null;
  busy: boolean;
  onBrowse: () => void;
  onDropFile: (file: File) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !busy) onDropFile(file);
  };

  return (
    <div
      role={preview ? undefined : "button"}
      tabIndex={preview ? undefined : 0}
      onClick={preview ? undefined : onBrowse}
      onKeyDown={(e) => {
        if (!preview && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onBrowse();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-md border-[0.75px] border-border px-4 py-12",
        !preview && "cursor-pointer",
        dragging && "border-muted-foreground bg-muted",
      )}
    >
      {preview ? (
        <>
          <div className="h-28 w-[86px] overflow-hidden rounded-sm border border-border bg-muted shadow-sm">
            {preview.coverUrl && (
              <img
                src={preview.coverUrl}
                alt=""
                className="h-full w-full object-cover object-top"
              />
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <p>{preview.name}</p>
              {!busy && (
                <button
                  type="button"
                  aria-label="Remove file"
                  onClick={onClear}
                  className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-sm tabular-nums text-muted-foreground">
              {preview.pageCount != null &&
                `${preview.pageCount} ${
                  preview.pageCount === 1 ? "page" : "pages"
                } · `}
              {formatSize(preview.sizeBytes)}
            </p>
          </div>
        </>
      ) : (
        <>
          <p>Choose a PDF</p>
          <p className="text-sm text-muted-foreground">
            Click to browse, or drop it here
          </p>
        </>
      )}
    </div>
  );
}

export function ImportPdfDialog({
  open,
  preview,
  phase,
  ocr,
  onOcrChange,
  error,
  onBrowse,
  onDropFile,
  onClear,
  onImport,
  onCancel,
}: {
  open: boolean;
  preview: PdfPreview | null;
  phase: ImportPhase;
  ocr: boolean;
  onOcrChange: (ocr: boolean) => void;
  error: string | null;
  onBrowse: () => void;
  onDropFile: (file: File) => void;
  onClear: () => void;
  onImport: () => void;
  onCancel: () => void;
}) {
  const busy = phase.kind !== "review";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent hideClose={true}>
        <DialogHeader>
          <DialogTitle>
            <p className="text-xl">Add PDF</p>
            <p className="text-sm font-normal text-muted-foreground">
              Import a PDF from your computer into your library.
            </p>
          </DialogTitle>

          <div className="mb-2" />

          <FileBox
            preview={preview}
            busy={busy}
            onBrowse={onBrowse}
            onDropFile={onDropFile}
            onClear={onClear}
          />

          <div className="pt-2">
            <OcrOption
              checked={ocr}
              onCheckedChange={onOcrChange}
              disabled={busy}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div>
            <Button
              disabled={busy || preview?.pageCount == null}
              className="mt-4 w-full"
              onClick={onImport}
            >
              {busy ? (
                <>
                  <Spinner />
                  <span className="tabular-nums">
                    {phase.kind === "ocr"
                      ? ocrProgressLabel(phase.progress)
                      : "Importing…"}
                  </span>
                </>
              ) : (
                "Import"
              )}
            </Button>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

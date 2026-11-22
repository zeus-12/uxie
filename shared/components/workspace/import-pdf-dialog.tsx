import { FileText } from "lucide-react";

import { ocrProgressLabel, type OcrProgress } from "../../lib/ocr";
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

function SelectedFile({
  preview,
  onChange,
  disabled,
}: {
  preview: PdfPreview;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-md border-[0.75px] border-gray-300 p-4">
      <div className="flex h-[84px] w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-gray-200 bg-gray-50 shadow-sm">
        {preview.coverUrl ? (
          <img
            src={preview.coverUrl}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <FileText aria-hidden="true" className="h-5 w-5 text-gray-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={preview.name}>
          {preview.name}
        </p>
        <p className="mt-0.5 text-sm tabular-nums text-gray-500">
          {preview.pageCount != null &&
            `${preview.pageCount} ${
              preview.pageCount === 1 ? "page" : "pages"
            } · `}
          {formatSize(preview.sizeBytes)}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onChange} disabled={disabled}>
        Change
      </Button>
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
  onChangeFile,
  onCancel,
}: {
  preview: PdfPreview | null;
  phase: ImportPhase;
  ocr: boolean;
  onOcrChange: (ocr: boolean) => void;
  error: string | null;
  onImport: () => void;
  onChangeFile: () => void;
  onCancel: () => void;
}) {
  const busy = phase.kind !== "review";

  return (
    <Dialog
      open={preview !== null}
      onOpenChange={(open) => !open && onCancel()}
    >
      <DialogContent hideClose={true}>
        <DialogHeader>
          <DialogTitle>
            <p className="text-xl">Add PDF</p>
            <p className="text-sm font-normal text-gray-500">
              Import a PDF from your computer into your library.
            </p>
          </DialogTitle>

          <div className="mb-2" />

          {preview && (
            <SelectedFile
              preview={preview}
              onChange={onChangeFile}
              disabled={busy}
            />
          )}

          <div className="my-3 pt-3">
            <OcrOption
              checked={ocr}
              onCheckedChange={onOcrChange}
              disabled={busy}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
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
            {phase.kind === "ocr" && (
              <Button
                variant="ghost"
                className="mt-2 w-full text-gray-500"
                onClick={onCancel}
              >
                Stop OCR
              </Button>
            )}
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

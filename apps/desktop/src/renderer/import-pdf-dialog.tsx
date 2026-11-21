import { useState } from "react";
import { Button } from "@uxie/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@uxie/shared/components/ui/dialog";
import { Spinner } from "@uxie/shared/components/ui/spinner";
import { OcrOption } from "@uxie/shared/components/workspace/ocr-option";
import {
  ocrPdf,
  ocrProgressLabel,
  type OcrProgress,
} from "@uxie/shared/lib/ocr";
import type { Document } from "@uxie/shared/schema";

type ImportState =
  | { kind: "idle" }
  | { kind: "importing" }
  | { kind: "ocr"; progress: OcrProgress };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function applyOcr(
  name: string,
  bytes: Uint8Array,
  onProgress: (progress: OcrProgress) => void,
): Promise<Uint8Array> {
  const file = new File([bytes], name, { type: "application/pdf" });
  const result = await ocrPdf(file, onProgress);
  return result === file ? bytes : new Uint8Array(await result.arrayBuffer());
}

export function ImportPdfDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (doc: Document) => void;
}) {
  const [doOcr, setDoOcr] = useState(false);
  const [state, setState] = useState<ImportState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const busy = state.kind !== "idle";

  async function choosePdf() {
    setError(null);
    try {
      const picked = await window.uxieAPI.pickPdf();
      if (!picked) return;
      const bytes = doOcr
        ? await applyOcr(picked.name, picked.bytes, (progress) =>
            setState({ kind: "ocr", progress }),
          )
        : picked.bytes;
      setState({ kind: "importing" });
      const doc = await window.uxieAPI.importDocument(picked.name, bytes);
      onOpenChange(false);
      onImported(doc);
    } catch (e) {
      setError(message(e));
    } finally {
      setState({ kind: "idle" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent hideClose={busy}>
        <DialogHeader>
          <DialogTitle>Add PDF</DialogTitle>
          <DialogDescription>
            Import a PDF from your computer.
          </DialogDescription>
        </DialogHeader>

        <OcrOption checked={doOcr} onCheckedChange={setDoOcr} disabled={busy} />

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <Button disabled={busy} onClick={choosePdf} className="w-full">
          {busy ? (
            <>
              <Spinner />
              <span>
                {state.kind === "ocr"
                  ? ocrProgressLabel(state.progress)
                  : "Importing…"}
              </span>
            </>
          ) : (
            "Choose PDF…"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

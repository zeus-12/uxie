import { useRef, useState } from "react";
import {
  ImportPdfDialog,
  type ImportPhase,
  type PdfPreview,
} from "@uxie/shared/components/workspace/import-pdf-dialog";
import { ocrPdf, type OcrProgress } from "@uxie/shared/lib/ocr";
import type { Document } from "@uxie/shared/schema";
import type { PickedPdf } from "../ipc-contract";
import { previewPdf } from "./pdf-cover";

interface Pending {
  picked: PickedPdf;
  preview: PdfPreview;
  cover: Uint8Array | null;
}

const basePreview = (picked: PickedPdf): PdfPreview => ({
  name: picked.name,
  sizeBytes: picked.bytes.byteLength,
  pageCount: null,
  coverUrl: null,
});

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function applyOcr(
  { name, bytes }: PickedPdf,
  onProgress: (progress: OcrProgress) => void,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const file = new File([bytes], name, { type: "application/pdf" });
  const result = await ocrPdf(file, onProgress, signal);
  return result === file ? bytes : new Uint8Array(await result.arrayBuffer());
}

export function usePdfImport(
  onImported: (doc: Document, cover: Uint8Array | null) => void,
) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [phase, setPhase] = useState<ImportPhase>({ kind: "review" });
  const [ocr, setOcr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<PickedPdf | null>(null);
  const abort = useRef<AbortController | null>(null);

  function clear() {
    if (pending?.preview.coverUrl)
      URL.revokeObjectURL(pending.preview.coverUrl);
    current.current = null;
    setPending(null);
    setError(null);
  }

  function close() {
    clear();
    abort.current = null;
    setOpen(false);
    setPhase({ kind: "review" });
  }

  async function load(picked: PickedPdf) {
    clear();
    current.current = picked;
    setPending({ picked, preview: basePreview(picked), cover: null });

    try {
      const { pageCount, cover } = await previewPdf(picked.bytes);
      if (current.current !== picked) return;
      const coverUrl = cover
        ? URL.createObjectURL(new Blob([cover], { type: "image/png" }))
        : null;
      setPending({
        picked,
        preview: { ...basePreview(picked), pageCount, coverUrl },
        cover,
      });
    } catch (e) {
      if (current.current === picked) setError(message(e));
    }
  }

  async function browse() {
    try {
      const picked = await window.uxieAPI.pickPdf();
      if (picked) await load(picked);
    } catch (e) {
      setError(message(e));
    }
  }

  async function start() {
    const picked = await window.uxieAPI.pickPdf();
    if (!picked) return;
    setOcr(false);
    setOpen(true);
    await load(picked);
  }

  async function dropFile(file: File) {
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setError("Only PDF files can be imported.");
      return;
    }
    await load({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  }

  async function confirm() {
    if (!pending) return;
    const controller = new AbortController();
    abort.current = controller;
    setError(null);

    try {
      const bytes = ocr
        ? await applyOcr(
            pending.picked,
            (progress) => setPhase({ kind: "ocr", progress }),
            controller.signal,
          )
        : pending.picked.bytes;
      setPhase({ kind: "importing" });
      const doc = await window.uxieAPI.importDocument(
        pending.picked.name,
        bytes,
      );
      close();
      onImported(doc, pending.cover);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(message(e));
      setPhase({ kind: "review" });
    }
  }

  function cancel() {
    if (phase.kind === "importing") return;
    abort.current?.abort();
    close();
  }

  const dialog = (
    <ImportPdfDialog
      open={open}
      preview={pending?.preview ?? null}
      phase={phase}
      ocr={ocr}
      onOcrChange={setOcr}
      error={error}
      onBrowse={browse}
      onDropFile={(file) => void dropFile(file)}
      onClear={clear}
      onImport={confirm}
      onCancel={cancel}
    />
  );

  return { start, dialog };
}

/// <reference path="../types/scribe.d.ts" />
import type { ScribeDocument } from "scribe.js-ocr";

export type OcrProgress =
  | { kind: "loading" | "reading" | "exporting" }
  | {
      kind: "recognizing";
      pages: { completed: number; total: number } | null;
    };

export function ocrProgressLabel(progress: OcrProgress): string {
  switch (progress.kind) {
    case "loading":
      return "Loading OCR…";
    case "reading":
      return "Reading PDF…";
    case "recognizing":
      return progress.pages
        ? `Recognized ${progress.pages.completed} of ${progress.pages.total} pages…`
        : "Recognizing text…";
    case "exporting":
      return "Saving searchable PDF…";
  }
}

const countTrue = (mask: boolean[] | null) =>
  mask ? mask.filter(Boolean).length : 0;

async function recognizeIntoPdf(
  doc: ScribeDocument,
  file: File,
  onProgress: (progress: OcrProgress) => void,
): Promise<File> {
  const recognizedPages = new Set<number>();
  // Scribe files each Tesseract page under the "Combined" layer, whichever engine ran.
  doc.progressHandler = (message) => {
    if (
      message.type !== "convert" ||
      message.info?.engineName !== "Combined" ||
      typeof message.n !== "number"
    ) {
      return;
    }
    recognizedPages.add(message.n);
    onProgress({
      kind: "recognizing",
      pages: {
        completed: recognizedPages.size,
        total: countTrue(doc.inputData.ocrApplied),
      },
    });
  };

  onProgress({ kind: "recognizing", pages: null });
  await doc.recognize({
    langs: ["eng"],
    modeAdv: "lstm",
    vanillaMode: false,
    ocrPages: "autoShallow",
  });

  if (countTrue(doc.inputData.ocrApplied) === 0) return file;

  onProgress({ kind: "exporting" });
  const data = await doc.exportData("pdf", { displayMode: "invis" });
  if (typeof data === "string") {
    throw new Error("OCR export returned text instead of a PDF.");
  }
  return new File([data], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

export async function ocrPdf(
  file: File,
  onProgress: (progress: OcrProgress) => void,
): Promise<File> {
  onProgress({ kind: "loading" });
  const { default: scribe } = await import("scribe.js-ocr");
  onProgress({ kind: "reading" });
  const doc = await scribe.openDocument([file]);

  let result: File;
  try {
    result = await recognizeIntoPdf(doc, file, onProgress);
  } catch (error) {
    await doc.close().catch(() => {});
    throw error;
  }
  await doc.close();
  return result;
}

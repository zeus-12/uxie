import type { PDFDocumentProxy } from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import { create } from "zustand";

// A page's text as pdf.js's text layer shows it: one entry per non-empty item.
export type PdfTextSource = {
  blocks: (pageNumber: number) => string[] | null;
  prefetch: (pageNumber: number) => void;
  ready: (pageNumber: number) => Promise<void>;
};

export const createPdfTextSource = (doc: PDFDocumentProxy): PdfTextSource => {
  const cache = new Map<number, string[]>();
  const pending = new Map<number, Promise<void>>();
  const prefetch = (pageNumber: number): Promise<void> => {
    if (pageNumber < 1 || pageNumber > doc.numPages || cache.has(pageNumber)) {
      return Promise.resolve();
    }
    const inFlight = pending.get(pageNumber);
    if (inFlight) return inFlight;
    const load = doc
        .getPage(pageNumber)
        .then((page) => page.getTextContent({ includeMarkedContent: true, disableCombineTextItems: false }))
        .then((content) => {
          const strings = (content.items as Array<TextItem | TextMarkedContent>)
            .filter((item): item is TextItem => "str" in item)
            .map((item) => item.str)
            .filter((str) => str !== "");
          cache.set(pageNumber, strings);
        })
        .catch(() => {
          cache.set(pageNumber, []);
        })
        .finally(() => pending.delete(pageNumber));
    pending.set(pageNumber, load);
    return load;
  };
  return {
    blocks: (pageNumber) => cache.get(pageNumber) ?? null,
    prefetch: (pageNumber) => void prefetch(pageNumber),
    ready: prefetch,
  };
};

export const usePdfTextStore = create<{
  source: PdfTextSource | null;
  setSource: (source: PdfTextSource | null) => void;
}>((set) => ({
  source: null,
  setSource: (source) => set({ source }),
}));

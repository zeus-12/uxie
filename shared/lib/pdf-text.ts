import type { PDFDocumentProxy } from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import { create } from "zustand";

// A page's text as pdf.js's text layer shows it: one entry per non-empty item.
export type PdfTextSource = {
  blocks: (pageNumber: number) => string[] | null;
  prefetch: (pageNumber: number) => void;
};

export const createPdfTextSource = (doc: PDFDocumentProxy): PdfTextSource => {
  const cache = new Map<number, string[]>();
  const pending = new Set<number>();
  return {
    blocks: (pageNumber) => cache.get(pageNumber) ?? null,
    prefetch: (pageNumber) => {
      if (pageNumber < 1 || pageNumber > doc.numPages) return;
      if (cache.has(pageNumber) || pending.has(pageNumber)) return;
      pending.add(pageNumber);
      doc
        .getPage(pageNumber)
        .then((page) => page.getTextContent({ includeMarkedContent: true, disableCombineTextItems: false }))
        .then((content) => {
          const strings = (content.items as Array<TextItem | TextMarkedContent>)
            .filter((item): item is TextItem => "str" in item)
            .map((item) => item.str)
            .filter((str) => str !== "");
          cache.set(pageNumber, strings);
        })
        .catch(() => undefined)
        .finally(() => pending.delete(pageNumber));
    },
  };
};

export const usePdfTextStore = create<{
  source: PdfTextSource | null;
  setSource: (source: PdfTextSource | null) => void;
}>((set) => ({
  source: null,
  setSource: (source) => set({ source }),
}));

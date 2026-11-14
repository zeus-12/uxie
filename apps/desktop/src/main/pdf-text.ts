import { readFile } from "fs/promises";
import type { PdfPageText } from "@uxie/shared/lib/chat";
import { getDocument } from "pdfjs-dist";
import { documentsDir } from "./pdf";
import { pdfPath } from "./pdf-store";

export async function extractPdfPages(docId: string): Promise<PdfPageText[]> {
  let bytes: Buffer;
  try {
    bytes = await readFile(pdfPath(documentsDir(), docId));
  } catch {
    throw new Error("Couldn't read this document's PDF file on disk.");
  }
  return extractPdfPagesFromBytes(bytes);
}

export async function extractPdfPagesFromBytes(
  bytes: Buffer,
): Promise<PdfPageText[]> {
  const pages: PdfPageText[] = [];
  const loadingTask = getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loadingTask.promise;
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.flatMap((item) =>
        "str" in item && typeof item.str === "string" ? [item.str] : [],
      );
      pages.push({ pageNumber, text: text.join(" ") });
      page.cleanup();
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}

export async function extractPdfText(docId: string): Promise<string> {
  const pages = await extractPdfPages(docId);
  return pages.map((page) => page.text).join("\n\n");
}

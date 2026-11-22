import { readFile } from "fs/promises";
import type { PdfPageText } from "@uxie/shared/lib/chat";
import { extractPdfPages as extractPdfPagesFromBytes } from "@uxie/shared/lib/pdf-pages";
import { documentsDir } from "./pdf";
import { pdfPath } from "./pdf-store";

export async function extractPdfPages(docId: string): Promise<PdfPageText[]> {
  let bytes: Buffer;
  try {
    bytes = await readFile(pdfPath(documentsDir(), docId));
  } catch {
    throw new Error("Couldn't read this document's PDF file on disk.");
  }
  return extractPdfPagesFromBytes(new Uint8Array(bytes));
}

export async function extractPdfText(docId: string): Promise<string> {
  const pages = await extractPdfPages(docId);
  return pages.map((page) => page.text).join("\n\n");
}

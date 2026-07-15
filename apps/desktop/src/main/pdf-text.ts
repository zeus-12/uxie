import { readFile } from "fs/promises";
// lib entry avoids pdf-parse's debug-mode index.js (which reads a test file).
// @ts-expect-error no bundled types for the subpath
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { documentsDir } from "./pdf";
import { pdfPath } from "./pdf-store";

export async function extractPdfText(docId: string): Promise<string> {
  let bytes: Buffer;
  try {
    bytes = await readFile(pdfPath(documentsDir(), docId));
  } catch {
    throw new Error("Couldn't read this document's PDF file on disk.");
  }
  const { text } = (await pdfParse(bytes)) as { text: string };
  return text;
}

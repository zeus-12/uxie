import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { PDFDocument } from "pdf-lib";

export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

export function pdfPath(dir: string, id: string): string {
  return join(dir, `${id}.pdf`);
}

export async function storePdf(
  dir: string,
  id: string,
  bytes: Uint8Array,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(pdfPath(dir, id), bytes);
}

export async function deletePdf(dir: string, id: string): Promise<void> {
  await rm(pdfPath(dir, id), { force: true });
}

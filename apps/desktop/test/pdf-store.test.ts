import { mkdtemp, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  countPdfPages,
  deletePdf,
  pdfPath,
  storePdf,
} from "../src/main/pdf-store";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return doc.save();
}

describe("pdf-store", () => {
  it("counts pages", async () => {
    expect(await countPdfPages(await makePdf(1))).toBe(1);
    expect(await countPdfPages(await makePdf(5))).toBe(5);
  });

  it("stores, resolves, and deletes a pdf file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "uxie-pdf-"));
    const bytes = await makePdf(2);

    await storePdf(dir, "abc", bytes);
    const path = pdfPath(dir, "abc");
    expect(existsSync(path)).toBe(true);
    expect((await readFile(path)).length).toBe(bytes.length);

    await deletePdf(dir, "abc");
    expect(existsSync(path)).toBe(false);
  });

  it("deletePdf is a no-op when the file is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "uxie-pdf-"));
    await expect(deletePdf(dir, "nope")).resolves.toBeUndefined();
  });

  it("counts pages from a real file round-trip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "uxie-pdf-"));
    await writeFile(pdfPath(dir, "r"), await makePdf(3));
    expect(await countPdfPages(await readFile(pdfPath(dir, "r")))).toBe(3);
  });
});

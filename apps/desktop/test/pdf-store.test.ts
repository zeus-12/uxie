import { mkdir, mkdtemp, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  countPdfPages,
  coverPath,
  deleteDocDir,
  deleteImage,
  imagePath,
  migrateToDocDirs,
  pdfPath,
  storeCover,
  storeImage,
  storePdf,
} from "../src/main/pdf-store";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return doc.save();
}

const tmpRoot = () => mkdtemp(join(tmpdir(), "uxie-pdf-"));

describe("pdf-store", () => {
  it("counts pages", async () => {
    expect(await countPdfPages(await makePdf(1))).toBe(1);
    expect(await countPdfPages(await makePdf(5))).toBe(5);
  });

  it("stores a pdf, a cover and images under one document folder", async () => {
    const root = await tmpRoot();
    const bytes = await makePdf(2);

    await storePdf(root, "abc", bytes);
    await storeCover(root, "abc", new Uint8Array([1, 2, 3]));
    await storeImage(root, "abc", "img1", new Uint8Array([4, 5]));

    expect(pdfPath(root, "abc")).toBe(join(root, "abc", "document.pdf"));
    expect((await readFile(pdfPath(root, "abc"))).length).toBe(bytes.length);
    expect(existsSync(coverPath(root, "abc"))).toBe(true);
    expect(existsSync(imagePath(root, "abc", "img1"))).toBe(true);
  });

  it("deleting the document removes its pdf, cover and every image", async () => {
    const root = await tmpRoot();
    await storePdf(root, "abc", await makePdf(1));
    await storeCover(root, "abc", new Uint8Array([1]));
    await storeImage(root, "abc", "img1", new Uint8Array([2]));
    await storeImage(root, "abc", "img2", new Uint8Array([3]));
    // A second document must be untouched.
    await storePdf(root, "other", await makePdf(1));

    await deleteDocDir(root, "abc");

    expect(existsSync(join(root, "abc"))).toBe(false);
    expect(existsSync(pdfPath(root, "other"))).toBe(true);
  });

  it("deletes a single image without touching the rest", async () => {
    const root = await tmpRoot();
    await storeImage(root, "abc", "img1", new Uint8Array([1]));
    await storeImage(root, "abc", "img2", new Uint8Array([2]));

    await deleteImage(root, "abc", "img1");

    expect(existsSync(imagePath(root, "abc", "img1"))).toBe(false);
    expect(existsSync(imagePath(root, "abc", "img2"))).toBe(true);
  });

  it("deleting a missing document or image is a no-op", async () => {
    const root = await tmpRoot();
    await expect(deleteDocDir(root, "nope")).resolves.toBeUndefined();
    await expect(deleteImage(root, "nope", "x")).resolves.toBeUndefined();
  });

  it("migrates the old flat layout into per-document folders", async () => {
    const root = await tmpRoot();
    const covers = join(root, "..", `covers-${Date.now()}`);
    await mkdir(covers, { recursive: true });

    const pdf = await makePdf(3);
    await writeFile(join(root, "doc1.pdf"), pdf);
    await writeFile(join(root, "doc2.pdf"), await makePdf(1));
    await writeFile(join(covers, "doc1.png"), new Uint8Array([9]));

    const migrated = await migrateToDocDirs(root, covers);

    expect(migrated).toBe(2);
    expect((await readFile(pdfPath(root, "doc1"))).length).toBe(pdf.length);
    expect(existsSync(pdfPath(root, "doc2"))).toBe(true);
    expect(existsSync(coverPath(root, "doc1"))).toBe(true);
    expect(existsSync(join(root, "doc1.pdf"))).toBe(false);
    expect(existsSync(covers)).toBe(false);
  });

  it("migration is safe to re-run and leaves new-layout documents alone", async () => {
    const root = await tmpRoot();
    const covers = join(root, "..", `covers-${Date.now()}-2`);
    await writeFile(join(root, "doc1.pdf"), await makePdf(1));

    await migrateToDocDirs(root, covers);
    const again = await migrateToDocDirs(root, covers);

    expect(again).toBe(0);
    expect(existsSync(pdfPath(root, "doc1"))).toBe(true);
  });
});

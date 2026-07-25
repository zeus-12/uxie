import { mkdir, readdir, rename, rm, rmdir, writeFile } from "fs/promises";
import { join } from "path";
import { PDFDocument } from "pdf-lib";

export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

/**
 * Everything a document owns lives under one directory:
 *
 *   <root>/<docId>/document.pdf
 *   <root>/<docId>/cover.png
 *   <root>/<docId>/images/<imageId>.png   (area highlights, pasted note images)
 *
 * Deleting the document is then a single recursive remove, so a new kind of
 * asset can't be forgotten by the cleanup path.
 */
export const docDir = (root: string, docId: string): string =>
  join(root, docId);

export const pdfPath = (root: string, docId: string): string =>
  join(docDir(root, docId), "document.pdf");

export const coverPath = (root: string, docId: string): string =>
  join(docDir(root, docId), "cover.png");

export const imagesDir = (root: string, docId: string): string =>
  join(docDir(root, docId), "images");

export const imagePath = (
  root: string,
  docId: string,
  imageId: string,
): string => join(imagesDir(root, docId), `${imageId}.png`);

export async function storePdf(
  root: string,
  docId: string,
  bytes: Uint8Array,
): Promise<void> {
  await mkdir(docDir(root, docId), { recursive: true });
  await writeFile(pdfPath(root, docId), bytes);
}

export async function storeCover(
  root: string,
  docId: string,
  bytes: Uint8Array,
): Promise<void> {
  await mkdir(docDir(root, docId), { recursive: true });
  await writeFile(coverPath(root, docId), bytes);
}

export async function storeImage(
  root: string,
  docId: string,
  imageId: string,
  bytes: Uint8Array,
): Promise<void> {
  await mkdir(imagesDir(root, docId), { recursive: true });
  await writeFile(imagePath(root, docId, imageId), bytes);
}

export async function deleteImage(
  root: string,
  docId: string,
  imageId: string,
): Promise<void> {
  await rm(imagePath(root, docId, imageId), { force: true });
}

/** Removes the pdf, the cover and every image in one go. */
export async function deleteDocDir(
  root: string,
  docId: string,
): Promise<void> {
  await rm(docDir(root, docId), { recursive: true, force: true });
}

/**
 * Moves an install off the original flat layout (`<root>/<id>.pdf` and
 * `<covers>/<id>.png`) into the per-document directories above. The stored
 * `uxie-pdf://doc/<id>` URLs address documents by id, not by path, so nothing
 * in the database has to change — only the files move.
 *
 * Returns the number of documents migrated.
 */
export async function migrateToDocDirs(
  root: string,
  legacyCoversRoot: string,
): Promise<number> {
  const migrated = new Set<string>();

  for (const entry of await readdirSafe(root)) {
    if (!entry.isFile() || !entry.name.endsWith(".pdf")) continue;
    const docId = entry.name.slice(0, -".pdf".length);
    await mkdir(docDir(root, docId), { recursive: true });
    await rename(join(root, entry.name), pdfPath(root, docId));
    migrated.add(docId);
  }

  for (const entry of await readdirSafe(legacyCoversRoot)) {
    if (!entry.isFile() || !entry.name.endsWith(".png")) continue;
    const docId = entry.name.slice(0, -".png".length);
    await mkdir(docDir(root, docId), { recursive: true });
    await rename(join(legacyCoversRoot, entry.name), coverPath(root, docId));
    migrated.add(docId);
  }

  // rmdir only succeeds on an empty directory — a leftover file means something
  // unexpected is in there, and deleting it silently would be worse than
  // leaving the folder behind.
  await rmdir(legacyCoversRoot).catch(() => {});

  return migrated.size;
}

async function readdirSafe(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

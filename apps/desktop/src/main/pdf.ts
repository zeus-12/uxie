import { app, dialog, protocol } from "electron";
import { readFile } from "fs/promises";
import { basename, join } from "path";
import { createId } from "@paralleldrive/cuid2";
import type { Document } from "@uxie/shared/schema";
import {
  createDocument,
  deleteDocument,
  getDb,
  getSqlite,
  updateDocumentCover,
} from "./db";
import { deleteVectors } from "./db/vectors";
import {
  coverPath,
  countPdfPages,
  deleteDocDir,
  imagePath,
  migrateToDocDirs,
  pdfPath,
  storeCover,
  storeImage,
  storePdf,
} from "./pdf-store";

export const PDF_SCHEME = "uxie-pdf";

export const documentsDir = () => join(app.getPath("userData"), "documents");
/** Pre-per-document-directory installs kept covers here. */
const legacyCoversDir = () => join(app.getPath("userData"), "covers");
const pdfUrl = (id: string) => `${PDF_SCHEME}://doc/${id}`;
const coverUrl = (id: string) => `${PDF_SCHEME}://cover/${id}`;
const imageUrl = (docId: string, imageId: string) =>
  `${PDF_SCHEME}://image/${docId}/${imageId}`;

export const PDF_PRIVILEGE = {
  scheme: PDF_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
    corsEnabled: true,
  },
};

// pdf.js fetches the bytes cross-origin (renderer is file:// / localhost), so
// the response needs an Access-Control-Allow-Origin header or it's CORS-blocked.
const CORS = { "access-control-allow-origin": "*" };

// Ids are cuid2s. Everything the protocol turns into a path is checked against
// this first, so a crafted url can't walk out of the document's directory.
const ID = /^[a-z0-9]+$/i;

export function registerPdfProtocol(): void {
  protocol.handle(PDF_SCHEME, async (request) => {
    const { host, pathname } = new URL(request.url);
    const segments = pathname.replace(/^\//, "").split("/");
    if (!segments.every((segment) => ID.test(segment))) {
      return new Response("bad id", { status: 400, headers: CORS });
    }

    const [docId, imageId] = segments;
    if (!docId) return new Response("bad id", { status: 400, headers: CORS });

    let filePath: string;
    let contentType: string;
    if (host === "cover") {
      filePath = coverPath(documentsDir(), docId);
      contentType = "image/png";
    } else if (host === "image") {
      if (!imageId) {
        return new Response("bad id", { status: 400, headers: CORS });
      }
      filePath = imagePath(documentsDir(), docId, imageId);
      contentType = "image/png";
    } else {
      filePath = pdfPath(documentsDir(), docId);
      contentType = "application/pdf";
    }

    try {
      const data = await readFile(filePath);
      return new Response(data, {
        headers: { "content-type": contentType, ...CORS },
      });
    } catch {
      return new Response("not found", { status: 404, headers: CORS });
    }
  });
}

/**
 * Moves an older install's files into the per-document directories. Safe to
 * call on every boot: with nothing left in the old layout it does nothing.
 */
export async function migrateDocumentStorage(): Promise<void> {
  const count = await migrateToDocDirs(documentsDir(), legacyCoversDir());
  if (count > 0) {
    console.log(`[uxie] moved ${count} document(s) into per-document folders`);
  }
}

export async function importPdf(): Promise<Document | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePaths[0]) return null;

  const bytes = await readFile(filePaths[0]);
  const pageCount = await countPdfPages(bytes);
  const id = createId();
  const title = basename(filePaths[0]).replace(/\.pdf$/i, "");

  const doc = await createDocument(getDb(), {
    id,
    title,
    url: pdfUrl(id),
    coverImageUrl: "",
    pageCount,
  });

  try {
    await storePdf(documentsDir(), id, bytes);
  } catch (err) {
    await deleteDocument(getDb(), id).catch(() => {});
    throw err;
  }
  return doc;
}

// The renderer rasterises page 1 (it has a real canvas + the doc's bytes over
// the protocol); main just persists those PNG bytes and records the URL. The
// cover is only shown once the file is actually on disk and the row updated.
export async function setDocumentCover(
  id: string,
  png: Uint8Array,
): Promise<string> {
  await storeCover(documentsDir(), id, png);
  const url = coverUrl(id);
  await updateDocumentCover(getDb(), id, url);
  return url;
}

/**
 * Writes an image belonging to a document — an area-highlight screenshot, or an
 * image pasted into its notes — and returns the url the renderer should embed.
 */
export async function storeDocumentImage(
  docId: string,
  png: Uint8Array,
): Promise<string> {
  const imageId = createId();
  await storeImage(documentsDir(), docId, imageId, png);
  return imageUrl(docId, imageId);
}

export async function deleteDocumentWithFile(id: string): Promise<void> {
  deleteVectors(getSqlite(), id);
  await deleteDocument(getDb(), id);
  // One remove takes the pdf, the cover and every image with it.
  await deleteDocDir(documentsDir(), id);
}

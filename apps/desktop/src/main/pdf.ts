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
  deleteCover,
  deletePdf,
  pdfPath,
  storeCover,
  storePdf,
} from "./pdf-store";

export const PDF_SCHEME = "uxie-pdf";

export const documentsDir = () => join(app.getPath("userData"), "documents");
export const coversDir = () => join(app.getPath("userData"), "covers");
const pdfUrl = (id: string) => `${PDF_SCHEME}://doc/${id}`;
const coverUrl = (id: string) => `${PDF_SCHEME}://cover/${id}`;

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

export function registerPdfProtocol(): void {
  protocol.handle(PDF_SCHEME, async (request) => {
    const { host, pathname } = new URL(request.url);
    const id = pathname.replace(/^\//, "");
    if (!/^[a-z0-9]+$/i.test(id)) {
      return new Response("bad id", { status: 400, headers: CORS });
    }
    const isCover = host === "cover";
    const filePath = isCover
      ? coverPath(coversDir(), id)
      : pdfPath(documentsDir(), id);
    try {
      const data = await readFile(filePath);
      return new Response(data, {
        headers: {
          "content-type": isCover ? "image/png" : "application/pdf",
          ...CORS,
        },
      });
    } catch {
      return new Response("not found", { status: 404, headers: CORS });
    }
  });
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
  await storeCover(coversDir(), id, png);
  const url = coverUrl(id);
  await updateDocumentCover(getDb(), id, url);
  return url;
}

export async function deleteDocumentWithFile(id: string): Promise<void> {
  deleteVectors(getSqlite(), id);
  await deleteDocument(getDb(), id);
  await deletePdf(documentsDir(), id);
  await deleteCover(coversDir(), id);
}

import { app, dialog, protocol } from "electron";
import { readFile } from "fs/promises";
import { basename, join } from "path";
import { createId } from "@paralleldrive/cuid2";
import type { Document } from "@uxie/shared/schema";
import { createDocument, deleteDocument, getDb, getSqlite } from "./db";
import { deleteVectors } from "./db/vectors";
import { countPdfPages, deletePdf, pdfPath, storePdf } from "./pdf-store";

export const PDF_SCHEME = "uxie-pdf";

export const documentsDir = () => join(app.getPath("userData"), "documents");
const pdfUrl = (id: string) => `${PDF_SCHEME}://doc/${id}`;

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
    const id = new URL(request.url).pathname.replace(/^\//, "");
    if (!/^[a-z0-9]+$/i.test(id)) {
      return new Response("bad id", { status: 400, headers: CORS });
    }
    try {
      const data = await readFile(pdfPath(documentsDir(), id));
      return new Response(data, {
        headers: { "content-type": "application/pdf", ...CORS },
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

export async function deleteDocumentWithFile(id: string): Promise<void> {
  deleteVectors(getSqlite(), id);
  await deleteDocument(getDb(), id);
  await deletePdf(documentsDir(), id);
}

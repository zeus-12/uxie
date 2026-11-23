import * as pdfjsNs from "pdfjs-dist/legacy/build/pdf";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.js?url";
import type { PDFDocumentProxy } from "pdfjs-dist";

// The legacy build is UMD/CJS; depending on the bundler's interop, the API can
// land on the namespace directly or under `.default`. Pick whichever has it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfjs: any = (pdfjsNs as any).getDocument
  ? pdfjsNs
  : (pdfjsNs as any).default;

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const PDF_SCHEME = "uxie-pdf";

// Rasterise page 1 into a PNG for the library thumbnail. This runs in the
// renderer because that's where a real <canvas> is; main just persists the bytes.
async function renderFirstPage(
  pdf: PDFDocumentProxy,
): Promise<Uint8Array | null> {
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) return null;

  await page.render({ canvasContext, viewport }).promise;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

export async function generateCover(docId: string): Promise<Uint8Array | null> {
  const pdf = await pdfjs.getDocument(`${PDF_SCHEME}://doc/${docId}`).promise;
  try {
    return await renderFirstPage(pdf);
  } finally {
    await pdf.destroy();
  }
}

// pdf.js transfers the buffer it is given to its worker, so it gets a copy.
export async function previewPdf(
  bytes: Uint8Array,
): Promise<{ pageCount: number; cover: Uint8Array | null }> {
  const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    return { pageCount: pdf.numPages, cover: await renderFirstPage(pdf) };
  } finally {
    await pdf.destroy();
  }
}

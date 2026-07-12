import { createCanvas, DOMMatrix, DOMPoint } from "canvas";
import { getDocument } from "pdfjs-dist";
import { UTApi } from "uploadthing/server";

// @ts-expect-error - polyfill for Node.js
globalThis.DOMMatrix = DOMMatrix;
// @ts-expect-error - polyfill for Node.js
globalThis.DOMPoint = DOMPoint;

const utapi = new UTApi();

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(canvasAndContext: { canvas: any }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: { canvas: any }) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

async function extractFirstPageAsImage(
  pdfBuffer: ArrayBuffer,
): Promise<Buffer> {
  const pdfDoc = await getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
  }).promise;

  const page = await pdfDoc.getPage(1);
  const scale = 1.5;
  const viewport = page.getViewport({ scale });

  const canvasFactory = new NodeCanvasFactory();
  const canvasAndContext = canvasFactory.create(
    Math.floor(viewport.width),
    Math.floor(viewport.height),
  );

  await page.render({
    canvasContext: canvasAndContext.context as any,
    viewport,
    canvasFactory: canvasFactory as any,
  }).promise;

  const pngBuffer = canvasAndContext.canvas.toBuffer("image/png");
  canvasFactory.destroy(canvasAndContext);

  return pngBuffer;
}

export async function generateAndUploadCover(
  pdfArrayBuffer: ArrayBuffer,
  fileName: string,
): Promise<string | undefined> {
  try {
    const imageBuffer = await extractFirstPageAsImage(pdfArrayBuffer);
    const sanitizedName = fileName
      .replace(".pdf", "")
      .replace(/[^a-zA-Z0-9]/g, "_");
    
    const imageBufferView = new Uint8Array(imageBuffer);

    const imageFile = new File([imageBufferView], `${sanitizedName}-cover.png`, {
      type: "image/png",
    });

    const uploadResult = await utapi.uploadFiles(imageFile);
    return uploadResult.data?.url ?? undefined;
  } catch (err: any) {
    console.log("Failed to generate cover image:", err.message);
    return undefined;
  }
}


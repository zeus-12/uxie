import { FREE_PLAN, PLANS } from "@/lib/constants";
import { getServerAuthSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { createCanvas, DOMMatrix, DOMPoint } from "canvas";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { getDocument } from "pdfjs-dist";
import { createUploadthing, type FileRouter } from "uploadthing/next-legacy";
import { UTApi } from "uploadthing/server";

// @ts-expect-error - polyfill for Node.js
globalThis.DOMMatrix = DOMMatrix;
// @ts-expect-error - polyfill for Node.js
globalThis.DOMPoint = DOMPoint;

const f = createUploadthing();
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

async function extractFirstPageAsImage(pdfBuffer: ArrayBuffer) {
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

export const docUploader = {
  // TODO allow for diff file size based on plan
  docUploader: f({ pdf: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async ({ req, res }) => {
      const session = await getServerAuthSession({ req, res });
      if (!session?.user) throw new Error("Unauthorized");

      const userFilesCount = await prisma.document.count({
        where: {
          owner: {
            id: session.user.id,
          },
        },
      });

      const userPlan = session?.user.plan ?? FREE_PLAN;
      const allowedDocsCount = PLANS[userPlan].maxDocs;

      if (userFilesCount >= allowedDocsCount) {
        throw new Error(
          "You have reached the maximum number of documents allowed for your plan",
        );
      }

      return { userId: session?.user?.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        const response = await fetch(file.url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (
          !response.headers.get("content-type")?.includes("application/pdf")
        ) {
          throw new Error("Invalid file type. Only PDFs are allowed.");
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const loader = new PDFLoader(blob);
        const pageLevelDocs = await loader.load();
        const numPages = pageLevelDocs.length;

        let coverImageUrl: string | undefined;
        try {
          const imageBuffer = await extractFirstPageAsImage(arrayBuffer);
          const imageBufferView = new Uint8Array(imageBuffer);

          const imageFile = new File(
            [imageBufferView],
            `${file.name.replace(".pdf", "")}-cover.png`,
            { type: "image/png" },
          );

          const uploadResult = await utapi.uploadFiles(imageFile);
          if (uploadResult.data?.url) {
            coverImageUrl = uploadResult.data.url;
          }
        } catch (imgErr: any) {
          console.log("Failed to extract cover image:", imgErr.message);
        }

        await prisma.document.create({
          data: {
            owner: {
              connect: {
                id: metadata.userId,
              },
            },
            url: file.url,
            title: file.name,
            pageCount: numPages,
            coverImageUrl: coverImageUrl || "",
          },
        });
      } catch (err: any) {
        console.log(err.message);
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof docUploader;

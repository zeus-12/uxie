import {
  FREE_PLAN,
  MAX_FILE_SIZE_MB_ANY_PLAN,
  PLANS,
  fileSizeBytes,
  fileSizeLabel,
} from "@/lib/constants";
import { generateAndUploadCover } from "@/lib/pdf-cover";
import { stripTextFromEnd } from "@/lib/utils";
import { getServerAuthSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { createUploadthing, type FileRouter } from "uploadthing/next-legacy";

const f = createUploadthing();

export const docUploader = {
  // The route's limit is the ceiling across all plans; the per-plan limit is
  // enforced in the middleware, which is the only place the user's plan is known.
  docUploader: f({
    pdf: {
      maxFileSize: fileSizeLabel(MAX_FILE_SIZE_MB_ANY_PLAN),
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req, res, files }) => {
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
      const { maxDocs, maxFileSizeMbPerDoc } = PLANS[userPlan];

      if (userFilesCount >= maxDocs) {
        throw new Error(
          "You have reached the maximum number of documents allowed for your plan",
        );
      }

      const maxBytes = fileSizeBytes(maxFileSizeMbPerDoc);
      if (files.some((file) => file.size > maxBytes)) {
        throw new Error(
          `Your plan allows PDFs up to ${fileSizeLabel(maxFileSizeMbPerDoc)}`,
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

        const coverImageUrl = await generateAndUploadCover(
          arrayBuffer,
          file.name,
        );

        const title = stripTextFromEnd(file.name, ".pdf");

        await prisma.document.create({
          data: {
            owner: {
              connect: {
                id: metadata.userId,
              },
            },
            url: file.url,
            title,
            pageCount: numPages,
            coverImageUrl: coverImageUrl ?? "",
          },
        });
      } catch (err: any) {
        console.log(err.message);
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof docUploader;

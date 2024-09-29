import { FREE_PLAN, PLANS } from "@/lib/constants";
import { getServerAuthSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { createUploadthing, type FileRouter } from "uploadthing/next-legacy";

const f = createUploadthing();

export const docUploader = {
  // TODO allow for diff file size based on plan
  docUploader: f({ pdf: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async ({ req, res, files, input }) => {
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
        const loader = new PDFLoader(blob);
        const pageLevelDocs = await loader.load();
        const numPages = pageLevelDocs.length;

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
          },
        });
      } catch (err: any) {
        console.log(err.message);
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof docUploader;

import { getServerAuthSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { getDocument } from "pdfjs-dist";
import { createUploadthing, type FileRouter } from "uploadthing/next-legacy";

const f = createUploadthing();

export const docUploader = {
  // TODO allow for diff file size based on plan
  docUploader: f({ pdf: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async ({ req, res, files, input }) => {
      const session = await getServerAuthSession({ req, res });
      if (!session?.user) throw new Error("Unauthorized");
      return { userId: session?.user?.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        const numPages = await getDocument(file.url).promise.then((doc) => {
          return doc.numPages;
          // pdfMetadata: await doc.getMetadata(),
        });

        // figure out some way to take a snapshot of the first page of the pdf and store that

        await prisma.document.create({
          data: {
            owner: {
              connect: {
                id: metadata.userId,
              },
            },
            url: file.url,
            title: file.name,
          },
        });
      } catch (err: any) {
        console.log(err.message, "error ");
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof docUploader;

import { vectoriseDocument } from "@/lib/vectorise";
import { getServerAuthSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { createUploadthing, type FileRouter } from "uploadthing/next-legacy";

const f = createUploadthing();

export const docUploader = {
  docUploader: f({ pdf: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async ({ req, res }) => {
      const session = await getServerAuthSession({ req, res });

      if (!session?.user) throw new Error("Unauthorized");

      return { userId: session?.user?.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        const newFile = await prisma.document.create({
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

        await vectoriseDocument(file.url, newFile.id);
      } catch (err: any) {
        console.log(err.message, "error ");
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof docUploader;

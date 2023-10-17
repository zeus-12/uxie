import { getServerAuthSession } from "@/server/auth";
import { prisma } from "@/server/db";

import { createUploadthing, type FileRouter } from "uploadthing/next-legacy";

const f = createUploadthing();

export const imageUploader = {
  imageUploader: f({ pdf: { maxFileSize: "16MB" } })
    .middleware(async ({ req, res }) => {
      const session = await getServerAuthSession({ req, res });

      if (!session?.user) throw new Error("Unauthorized");

      return { userId: session?.user?.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await prisma?.document.create({
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
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof imageUploader;

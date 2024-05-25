import { getServerAuthSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { createUploadthing, type FileRouter } from "uploadthing/next-legacy";

const f = createUploadthing();

export const docUploader = {
  // TODO allow for diff file size based on plan
  docUploader: f({ pdf: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async ({ req, res, files, input }) => {
      const session = await getServerAuthSession({ req, res });
      if (!session?.user) throw new Error("Unauthorized");

      // get pdf page count, and then check for plan limits, if its fine the pagecount to db as well.

      // const response = await fetch(fileUrl);
      // const blob = await response.blob();
      // const loader = new PDFLoader(blob);

      // const pageLevelDocs = await loader.load();
      // // better to add pagecount to db, so that "5 page" limit can be checked easily.
      // const pageCount = pageLevelDocs.length;

      // TODO check for doc counts based on plan
      return { userId: session?.user?.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
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

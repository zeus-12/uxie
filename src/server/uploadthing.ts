import { getPineconeClient } from "@/lib/pinecone";
import { getServerAuthSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { createUploadthing, type FileRouter } from "uploadthing/next-legacy";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";
import { env } from "@/env.mjs";

const f = createUploadthing();

export const imageUploader = {
  imageUploader: f({ pdf: { maxFileSize: "8MB" } })
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

        const response = await fetch(file.url);
        const blob = await response.blob();
        const loader = new PDFLoader(blob);
        const pageLevelDocs = await loader.load();

        const pinecone = getPineconeClient();
        const pineconeIndex = pinecone.Index("uxie");

        const combinedData = pageLevelDocs.map((document) => {
          return {
            ...document,
            metadata: {
              fileId: newFile.id,
            },
            dataset: "pdf", // Use a field to indicate the source dataset (e.g., 'pdf')
          };
        });

        const embeddings = new HuggingFaceInferenceEmbeddings({
          apiKey: env.HUGGINGFACE_API_KEY,
        });

        await PineconeStore.fromDocuments(combinedData, embeddings, {
          pineconeIndex,
        });

        await prisma.document.update({
          where: {
            id: newFile.id,
          },
          data: {
            isVectorised: true,
          },
        });
      } catch (err: any) {
        console.log(err.message, "error ");
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof imageUploader;

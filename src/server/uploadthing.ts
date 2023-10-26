// import { generateEmbeddings } from "@/lib/embeddings";
import { getPineconeClient } from "@/lib/pinecone";
import { getServerAuthSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { createUploadthing, type FileRouter } from "uploadthing/next-legacy";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";
import { env } from "@/env.mjs";

// import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers";
// import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers";
// const TransformersApi = Function(
//   'return import("langchain/embeddings/hf_transformers")',
// )();
// const { HuggingFaceTransformersEmbeddings } = await TransformersApi;

const f = createUploadthing();

export const imageUploader = {
  imageUploader: f({ pdf: { maxFileSize: "16MB" } })
    .middleware(async ({ req, res }) => {
      const session = await getServerAuthSession({ req, res });

      if (!session?.user) throw new Error("Unauthorized");

      return { userId: session?.user?.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const newFile = await prisma?.document.create({
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

      try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const loader = new PDFLoader(blob);
        const pageLevelDocs = await loader.load();

        // vectorize and index entire document
        const pinecone = await getPineconeClient();
        const pineconeIndex = pinecone.Index("uxie");

        // Add a 'dataset' field to the data to distinguish the source
        const combinedData = pageLevelDocs.map((document) => {
          return {
            ...document,
            metadata: {
              fileId: newFile.id,
            },
            dataset: "pdf", // Use a field to indicate the source dataset (e.g., 'pdf')
          };
        });

        // const { HuggingFaceTransformersEmbeddings } = await import(
        //   "langchain/embeddings/hf_transformers"
        // );

        // const embeddings = new HuggingFaceTransformersEmbeddings({
        //   // modelName: "jinaai/jina-embeddings-v2-small-en",
        //   modelName: "Xenova/all-MiniLM-L6-v2",
        //   // stripNewLines: true,
        // });

        const embeddings = new HuggingFaceInferenceEmbeddings({
          apiKey: env.HUGGINGFACE_API_KEY, // In Node.js defaults to process.env.HUGGINGFACEHUB_API_KEY
        });

        await PineconeStore.fromDocuments(combinedData, embeddings, {
          pineconeIndex,
        });
      } catch (err: any) {
        console.log(err.message, "error ");
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof imageUploader;

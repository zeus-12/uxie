import { PineconeStore } from "langchain/vectorstores/pinecone";
import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";
import { env } from "@/env.mjs";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { getPineconeClient } from "@/lib/pinecone";
import { prisma } from "@/server/db";

export const vectoriseDocument = async (fileUrl: string, newFileId: string) => {
  const response = await fetch(fileUrl);
  const blob = await response.blob();
  const loader = new PDFLoader(blob);

  const pageLevelDocs = await loader.load();
  const pageCount = pageLevelDocs.length;

  if (pageCount > 5) {
    throw new Error("Too many pages");
  }

  const pinecone = getPineconeClient();
  const pineconeIndex = pinecone.Index("uxie");

  const combinedData = pageLevelDocs.map((document) => {
    return {
      ...document,
      metadata: {
        fileId: newFileId,
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
      id: newFileId,
    },
    data: {
      isVectorised: true,
    },
  });
};

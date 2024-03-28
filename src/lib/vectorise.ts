import { env } from "@/env.mjs";
import { getPineconeClient } from "@/lib/pinecone";
import { prisma } from "@/server/db";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";
import { PineconeStore } from "langchain/vectorstores/pinecone";

export const vectoriseDocument = async (fileUrl: string, newFileId: string) => {
  const response = await fetch(fileUrl);
  const blob = await response.blob();
  const loader = new PDFLoader(blob);

  const pageLevelDocs = await loader.load();
  // better to add pagecount to db, so that "5 page" limit can be checked easily.
  const pageCount = pageLevelDocs.length;

  if (pageCount > 5) {
    throw new Error(
      "Document to be vectorised can have at max 5 pages for now.",
    );
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

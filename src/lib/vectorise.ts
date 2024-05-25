import { env } from "@/env.mjs";
import { getPineconeClient } from "@/lib/pinecone";
import { prisma } from "@/server/db";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";
import { PineconeStore } from "langchain/vectorstores/pinecone";

export const vectoriseDocument = async (
  fileUrl: string,
  newFileId: string,
  maxPagesAllowed: number,
) => {
  // TODO better to add pagecount to db, so that page count limit can be checked easily.
  const response = await fetch(fileUrl);
  const blob = await response.blob();
  const loader = new PDFLoader(blob);

  const pageLevelDocs = await loader.load();
  const pageCount = pageLevelDocs.length;

  if (pageCount > maxPagesAllowed) {
    throw new Error(
      `Document to be vectorised can have at max ${maxPagesAllowed} pages. Upgrade to use larger documents.`,
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
      dataset: "pdf",
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

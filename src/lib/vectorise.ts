import { env } from "@/env.mjs";
import { getPineconeClient } from "@/lib/pinecone";
import { prisma } from "@/server/db";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "langchain/vectorstores/pinecone";

export const vectoriseDocument = async (
  fileUrl: string,
  newFileId: string,
  maxPagesAllowed: number,
) => {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.headers.get("content-type")?.includes("application/pdf")) {
      throw new Error("Invalid file type. Only PDFs are allowed.");
    }

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

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await textSplitter.splitDocuments(pageLevelDocs);

    const combinedData = splitDocs.map((document) => {
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
  } catch (error) {
    console.error("Error in vectoriseDocument function:", error);
    throw new Error("Internal Server Error");
  }
};

export const retrieveRelevantDocumentContent = async (
  docId: string,
  question: string,
) => {
  const embeddings = new HuggingFaceInferenceEmbeddings({
    apiKey: env.HUGGINGFACE_API_KEY,
  });

  const pinecone = getPineconeClient();
  const pineconeIndex = pinecone.Index("uxie");

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    filter: {
      fileId: docId,
    },
  });

  const results = await vectorStore.similaritySearch(question, 4);
  return results;
};

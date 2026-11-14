import { env } from "@/env.mjs";
import { getPineconeClient } from "@/lib/pinecone";
import { prisma } from "@/server/db";
import { InferenceClient } from "@huggingface/inference";
import {
  retrievedChunkSchema,
  type PdfPageText,
  type RetrievedChunk,
} from "@uxie/shared/lib/chat";
import { findUniquePdfPageNumber } from "@uxie/shared/lib/pdf-text-layer";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { Embeddings } from "langchain/embeddings/base";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "langchain/vectorstores/pinecone";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pageNumberFromMetadata(metadata: unknown): number | null {
  if (!isRecord(metadata)) return null;
  if (
    typeof metadata.pageNumber === "number" &&
    Number.isInteger(metadata.pageNumber) &&
    metadata.pageNumber > 0
  ) {
    return metadata.pageNumber;
  }
  const location = metadata.loc;
  if (
    isRecord(location) &&
    typeof location.pageNumber === "number" &&
    Number.isInteger(location.pageNumber) &&
    location.pageNumber > 0
  ) {
    return location.pageNumber;
  }
  return null;
}

const parseEmbeddingResult = (result: unknown): number[] => {
  if (Array.isArray(result) && Array.isArray(result[0])) {
    return result[0] as number[];
  } else if (Array.isArray(result)) {
    return result as number[];
  } else {
    throw new Error("Invalid embedding format returned from HuggingFace");
  }
};

const createHuggingFaceEmbeddings = () => {
  const hf = new InferenceClient(env.HUGGINGFACE_API_KEY);

  return new (class extends Embeddings {
    constructor() {
      super({});
    }

    async embedDocuments(texts: string[]): Promise<number[][]> {
      const embeddings = await Promise.all(
        texts.map(async (text) => {
          const result = await hf.featureExtraction({
            model: "BAAI/bge-base-en-v1.5",
            inputs: text,
          });
          return parseEmbeddingResult(result);
        }),
      );
      return embeddings;
    }

    async embedQuery(text: string): Promise<number[]> {
      const result = await hf.featureExtraction({
        model: "BAAI/bge-base-en-v1.5",
        inputs: text,
      });
      return parseEmbeddingResult(result);
    }
  })();
};

// Helper to get Pinecone index
const getPineconeIndex = () => {
  const pinecone = getPineconeClient();
  return pinecone.Index("uxie");
};

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

    const pineconeIndex = getPineconeIndex();

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await textSplitter.splitDocuments(pageLevelDocs);

    const combinedData = splitDocs.map((document) => {
      const pageNumber = pageNumberFromMetadata(document.metadata);
      if (!pageNumber) {
        throw new Error("PDF loader returned a chunk without a page number");
      }
      return {
        ...document,
        metadata: {
          fileId: newFileId,
          pageNumber,
        },
        dataset: "pdf",
      };
    });

    const embeddings = createHuggingFaceEmbeddings();

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
): Promise<RetrievedChunk[]> => {
  if (!env.HUGGINGFACE_API_KEY) {
    throw new Error("HUGGINGFACE_API_KEY is not configured");
  }

  const embeddings = createHuggingFaceEmbeddings();
  const pineconeIndex = getPineconeIndex();

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    filter: {
      fileId: docId,
    },
  });

  const results = await vectorStore.similaritySearch(question, 4);
  const needsLegacyResolution = results.some(
    (result) => pageNumberFromMetadata(result.metadata) === null,
  );

  let legacyPages: PdfPageText[] = [];
  if (needsLegacyResolution) {
    try {
      const document = await prisma.document.findUnique({
        where: { id: docId },
        select: { url: true },
      });
      if (document) {
        const response = await fetch(document.url);
        if (response.ok) {
          const pageDocuments = await new PDFLoader(
            await response.blob(),
          ).load();
          legacyPages = pageDocuments.map((page, index) => ({
            pageNumber: pageNumberFromMetadata(page.metadata) ?? index + 1,
            text: page.pageContent,
          }));
        }
      }
    } catch {
      // Keep any new-format results that already carry valid provenance. If
      // every result is legacy, the empty-result guard below asks for reindexing.
    }
  }

  const chunks = results.flatMap((result): RetrievedChunk[] => {
    const pageNumber =
      pageNumberFromMetadata(result.metadata) ??
      findUniquePdfPageNumber(result.pageContent, legacyPages);
    const parsed = retrievedChunkSchema.safeParse({
      pageContent: result.pageContent,
      pageNumber,
    });
    return parsed.success ? [parsed.data] : [];
  });
  if (chunks.length === 0) {
    throw new Error(
      "This document needs to be indexed again before cited answers are available.",
    );
  }
  return chunks;
};

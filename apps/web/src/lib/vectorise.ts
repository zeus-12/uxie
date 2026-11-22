import { env } from "@/env.mjs";
import { getPineconeClient } from "@/lib/pinecone";
import {
  pageNumberFromMetadata,
  toGetInformationOutput,
} from "@/lib/retrieved-chunks";
import { fetchPublicResource } from "@/server/article/safe-fetch";
import { prisma } from "@/server/db";
import { InferenceClient } from "@huggingface/inference";
import { extractPdfPages } from "@uxie/shared/lib/pdf-pages";
import { JSDOM } from "jsdom";
import { Document as LangChainDocument } from "langchain/document";
import { Embeddings } from "langchain/embeddings/base";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "langchain/vectorstores/pinecone";

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

export const vectoriseDocument = async ({
  fileUrl,
  documentId,
  maxPagesAllowed,
  maxFileBytes,
  kind,
}: {
  fileUrl: string;
  documentId: string;
  maxPagesAllowed: number;
  maxFileBytes: number;
  kind: "PDF" | "ARTICLE";
}) => {
  try {
    let sourceDocuments: LangChainDocument[];
    if (kind === "ARTICLE") {
      const article = await prisma.articleDocument.findUnique({
        where: { documentId },
        select: {
          snapshots: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, contentHtml: true },
          },
        },
      });
      const snapshot = article?.snapshots[0];
      if (!snapshot) throw new Error("Article snapshot not found.");

      const dom = new JSDOM(`<main>${snapshot.contentHtml}</main>`);
      sourceDocuments = Array.from(
        dom.window.document.querySelectorAll<HTMLElement>(
          "[data-uxie-block-id]",
        ),
      )
        .map((block) => ({
          blockId: block.dataset.uxieBlockId,
          text: block.textContent?.trim(),
        }))
        .filter((block): block is { blockId: string; text: string } =>
          Boolean(block.blockId && block.text),
        )
        .map(
          ({ blockId, text }) =>
            new LangChainDocument({
              pageContent: text,
              metadata: {
                fileId: documentId,
                kind: "article",
                snapshotId: snapshot.id,
                blockId,
              },
            }),
        );
    } else {
      const resource = await fetchPublicResource({
        inputUrl: fileUrl,
        maxBytes: maxFileBytes,
      });
      if (!resource.contentType.includes("application/pdf")) {
        throw new Error("Invalid file type. Only PDFs are allowed.");
      }
      const arrayBuffer = resource.body.buffer.slice(
        resource.body.byteOffset,
        resource.body.byteOffset + resource.body.byteLength,
      );
      const pages = await extractPdfPages(new Uint8Array(arrayBuffer));
      if (pages.length > maxPagesAllowed) {
        throw new Error(
          `Document to be vectorised can have at max ${maxPagesAllowed} pages. Upgrade to use larger documents.`,
        );
      }
      sourceDocuments = pages.map(
        ({ pageNumber, text }) =>
          new LangChainDocument({
            pageContent: text,
            metadata: { pageNumber },
          }),
      );
    }

    const pineconeIndex = getPineconeIndex();

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await textSplitter.splitDocuments(sourceDocuments);

    const combinedData = splitDocs.map((document) => {
      if (kind === "ARTICLE") {
        return {
          ...document,
          metadata: {
            ...document.metadata,
            fileId: documentId,
            kind: "article",
          },
        };
      }
      const pageNumber = pageNumberFromMetadata(document.metadata);
      if (!pageNumber) {
        throw new Error("PDF loader returned a chunk without a page number");
      }
      return {
        ...document,
        metadata: { fileId: documentId, kind: "pdf", pageNumber },
      };
    });

    const embeddings = createHuggingFaceEmbeddings();

    await PineconeStore.fromDocuments(combinedData, embeddings, {
      pineconeIndex,
    });

    await prisma.document.update({
      where: {
        id: documentId,
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
  return toGetInformationOutput(results);
};

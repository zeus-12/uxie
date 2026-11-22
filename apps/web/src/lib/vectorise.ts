import { env } from "@/env.mjs";
import { MAX_FILE_SIZE_MB_ANY_PLAN, fileSizeBytes } from "@/lib/constants";
import { getPineconeClient } from "@/lib/pinecone";
import {
  needsPageLookup,
  pageNumberFromMetadata,
  toRetrievedChunk,
} from "@/lib/retrieved-chunks";
import { fetchPublicResource } from "@/server/article/safe-fetch";
import { prisma } from "@/server/db";
import { InferenceClient } from "@huggingface/inference";
import { type PdfPageText, type RetrievedChunk } from "@uxie/shared/lib/chat";
import { JSDOM } from "jsdom";
import { Document as LangChainDocument } from "langchain/document";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
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
      const loader = new PDFLoader(
        new Blob([arrayBuffer], { type: "application/pdf" }),
      );
      sourceDocuments = await loader.load();

      if (sourceDocuments.length > maxPagesAllowed) {
        throw new Error(
          `Document to be vectorised can have at max ${maxPagesAllowed} pages. Upgrade to use larger documents.`,
        );
      }
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
  const pages = results.some(needsPageLookup)
    ? await loadPdfPages(docId).catch((error: unknown) => {
        console.error("Couldn't recover pages for legacy vectors:", error);
        return [];
      })
    : [];
  const chunks = results.flatMap((result): RetrievedChunk[] => {
    const chunk = toRetrievedChunk(result, pages);
    return chunk ? [chunk] : [];
  });
  if (results.length > 0 && chunks.length === 0) {
    throw new Error(
      "This document needs to be indexed again before cited answers are available.",
    );
  }
  return chunks;
};

// Vectors indexed before page provenance carry no page number; the page is
// recovered from the PDF text only when the passage occurs on exactly one page.
const loadPdfPages = async (docId: string): Promise<PdfPageText[]> => {
  const document = await prisma.document.findUnique({
    where: { id: docId },
    select: { url: true },
  });
  if (!document) return [];
  const resource = await fetchPublicResource({
    inputUrl: document.url,
    maxBytes: fileSizeBytes(MAX_FILE_SIZE_MB_ANY_PLAN),
  });
  const bytes = resource.body.buffer.slice(
    resource.body.byteOffset,
    resource.body.byteOffset + resource.body.byteLength,
  );
  const pageDocuments = await new PDFLoader(
    new Blob([bytes], { type: "application/pdf" }),
  ).load();
  return pageDocuments.flatMap((page): PdfPageText[] => {
    const pageNumber = pageNumberFromMetadata(page.metadata);
    return pageNumber ? [{ pageNumber, text: page.pageContent }] : [];
  });
};

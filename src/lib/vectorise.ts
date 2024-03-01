import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";
import { env } from "@/env.mjs";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { prisma } from "@/server/db";
import { PrismaVectorStore } from "@langchain/community/vectorstores/prisma";
import { Embedding, Prisma } from "@prisma/client";

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

  const formattedDocs = pageLevelDocs.map((document, index) => {
    return {
      content: document.pageContent,
      pageNumber: document.metadata?.loc?.pageNumber ?? index,
    };
  });

  const vectorStore = PrismaVectorStore.withModel<Embedding>(prisma).create(
    new HuggingFaceInferenceEmbeddings({
      apiKey: env.HUGGINGFACE_API_KEY,
    }),
    {
      prisma: Prisma,
      tableName: "Embedding",
      vectorColumnName: "vector",
      columns: {
        id: PrismaVectorStore.IdColumn,
        content: PrismaVectorStore.ContentColumn,
      },
    },
  );

  await vectorStore.addModels(
    await prisma.$transaction(
      formattedDocs.map((doc, index) =>
        prisma.embedding.create({
          data: {
            content: doc.content,
            pageNumber: index,
            document: {
              connect: {
                id: newFileId,
              },
            },
          },
        }),
      ),
    ),
  );

  const qn = "Tell me more about the author.";

  vectorStore.similaritySearch(qn, 4, {
    documentId: {
      equals: newFileId,
    },
  });

  return;

  // const pinecone = getPineconeClient();
  // const pineconeIndex = pinecone.Index("uxie");

  const combinedData = pageLevelDocs.map((document, index) => {
    return {
      ...document,
      metadata: {
        fileId: newFileId,
        page: index,
      },
      dataset: "pdf", // Use a field to indicate the source dataset (e.g., 'pdf')
    };
  });
};

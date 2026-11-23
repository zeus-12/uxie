import { chunkPdfPages } from "@uxie/shared/lib/embeddings";
import type { RetrievedChunk } from "@uxie/shared/lib/chat";
import { embedBatchInWorker, embedTextInWorker } from "./embed-client";

export async function vectorise(
  docId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const pages = await window.uxieAPI.getDocumentPages(docId);
  const chunks = await chunkPdfPages(pages);
  if (chunks.length === 0) return;
  const embeddings = await embedBatchInWorker(
    chunks.map((chunk) => chunk.pageContent),
    onProgress,
  );
  await window.uxieAPI.storeEmbeddings(
    docId,
    chunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i]! })),
  );
}

export async function retrieve(
  docId: string,
  query: string,
  k = 4,
): Promise<RetrievedChunk[]> {
  const embedding = await embedTextInWorker(query);
  return window.uxieAPI.queryEmbeddings(docId, embedding, k);
}

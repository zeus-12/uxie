import { chunkText } from "@uxie/shared/lib/embeddings";
import { embedBatchInWorker, embedTextInWorker } from "./embed-client";

const MAX_CHUNKS = 300;

/** Embed a document's chunks (off the main thread) and store the vectors. */
export async function vectorise(
  docId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const text = await window.uxieAPI.getDocumentText(docId);
  const chunks = chunkText(text).slice(0, MAX_CHUNKS);
  if (chunks.length === 0) return;
  const embeddings = await embedBatchInWorker(chunks, onProgress);
  await window.uxieAPI.storeEmbeddings(
    docId,
    chunks.map((chunk, i) => ({ chunk, embedding: embeddings[i] })),
  );
}

/** Retrieve the most relevant chunks for a query within a document. */
export async function retrieve(
  docId: string,
  query: string,
  k = 4,
): Promise<string[]> {
  const embedding = await embedTextInWorker(query);
  return window.uxieAPI.queryEmbeddings(docId, embedding, k);
}

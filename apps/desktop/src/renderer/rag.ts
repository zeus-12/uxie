import { chunkText, embedBatch, embedText } from "@uxie/shared/lib/embeddings";

const MAX_CHUNKS = 300;

/** Embed a document's chunks (in-renderer) and store the vectors in main. */
export async function vectorise(
  docId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const text = await window.uxieAPI.getDocumentText(docId);
  const chunks = chunkText(text).slice(0, MAX_CHUNKS);
  if (chunks.length === 0) return;
  const embeddings = await embedBatch(chunks, onProgress);
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
  const embedding = await embedText(query);
  return window.uxieAPI.queryEmbeddings(docId, embedding, k);
}

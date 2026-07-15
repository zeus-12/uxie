import { eq } from "drizzle-orm";
import * as schema from "@uxie/shared/schema";
import { getDb, getSqlite } from "./db";
import {
  queryVectors,
  upsertVectors,
  type EmbeddedChunk,
} from "./db/vectors";

/** Store a document's chunk embeddings and mark it vectorised. */
export async function storeEmbeddings(
  docId: string,
  items: EmbeddedChunk[],
): Promise<void> {
  upsertVectors(getSqlite(), docId, items);
  await getDb()
    .update(schema.document)
    .set({ isVectorised: true })
    .where(eq(schema.document.id, docId));
}

export function queryEmbeddings(
  docId: string,
  embedding: number[],
  k: number,
): string[] {
  return queryVectors(getSqlite(), docId, embedding, k);
}

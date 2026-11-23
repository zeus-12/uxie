import { eq } from "drizzle-orm";
import * as schema from "@uxie/shared/schema";
import type { RetrievedChunk } from "@uxie/shared/lib/chat";
import { getDb, getSqlite } from "./db";
import { queryVectors, upsertVectors, type EmbeddedChunk } from "./db/vectors";

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
): RetrievedChunk[] {
  return queryVectors(getSqlite(), docId, embedding, k);
}

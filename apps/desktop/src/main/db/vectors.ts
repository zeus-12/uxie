import type Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

// all-MiniLM-L6-v2 embedding dimension. If the embedding model changes, this
// (and the stored vectors) must change — a mismatch is rejected by sqlite-vec.
export const EMBEDDING_DIM = 384;

export function initVectorStore(sqlite: Database.Database): void {
  sqliteVec.load(sqlite);
  sqlite.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS doc_vectors USING vec0(
       doc_id TEXT partition key,
       embedding FLOAT[${EMBEDDING_DIM}],
       +chunk TEXT
     )`,
  );
}

export interface EmbeddedChunk {
  chunk: string;
  embedding: number[];
}

/** Replace all vectors for a document (idempotent re-vectorise). */
export function upsertVectors(
  sqlite: Database.Database,
  docId: string,
  items: EmbeddedChunk[],
): void {
  const del = sqlite.prepare("DELETE FROM doc_vectors WHERE doc_id = ?");
  const ins = sqlite.prepare(
    "INSERT INTO doc_vectors(doc_id, embedding, chunk) VALUES (?, ?, ?)",
  );
  const tx = sqlite.transaction(() => {
    del.run(docId);
    for (const it of items) {
      ins.run(docId, JSON.stringify(it.embedding), it.chunk);
    }
  });
  tx();
}

export function deleteVectors(sqlite: Database.Database, docId: string): void {
  sqlite.prepare("DELETE FROM doc_vectors WHERE doc_id = ?").run(docId);
}

export function hasVectors(sqlite: Database.Database, docId: string): boolean {
  const row = sqlite
    .prepare("SELECT COUNT(*) as n FROM doc_vectors WHERE doc_id = ?")
    .get(docId) as { n: number };
  return row.n > 0;
}

/** Nearest chunks for a query embedding within one document. */
export function queryVectors(
  sqlite: Database.Database,
  docId: string,
  embedding: number[],
  k: number,
): string[] {
  const rows = sqlite
    .prepare(
      `SELECT chunk FROM doc_vectors
       WHERE doc_id = ? AND embedding MATCH ? AND k = ?
       ORDER BY distance`,
    )
    .all(docId, JSON.stringify(embedding), k) as { chunk: string }[];
  return rows.map((r) => r.chunk);
}

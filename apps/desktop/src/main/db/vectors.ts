import type Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { DESKTOP_EMBEDDING } from "@uxie/shared/lib/embedding-models";

// Sized for whichever model the desktop embeds with — changing the model there
// changes this, so the two can no longer drift apart silently.
export const EMBEDDING_DIM = DESKTOP_EMBEDDING.dim;

const CREATE_VECTOR_TABLE = `CREATE VIRTUAL TABLE doc_vectors USING vec0(
       doc_id TEXT partition key,
       embedding FLOAT[${EMBEDDING_DIM}],
       +chunk TEXT
     )`;

/** The dimension an existing doc_vectors table was created with, if it exists. */
function existingDim(sqlite: Database.Database): number | null {
  const row = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE name = 'doc_vectors'")
    .get() as { sql: string } | undefined;
  if (!row) return null;
  const match = row.sql.match(/FLOAT\[(\d+)\]/i);
  return match ? Number(match[1]) : null;
}

/**
 * Load sqlite-vec and make sure doc_vectors is sized for the current model.
 * Returns true when the table was rebuilt, meaning every stored vector is gone
 * and the callers' `isVectorised` flags are now lies.
 */
export function initVectorStore(sqlite: Database.Database): boolean {
  sqliteVec.load(sqlite);

  // Vectors are derived data — if the embedding model changed, the old table is
  // the wrong width and every insert would fail at runtime. Drop and rebuild.
  const dim = existingDim(sqlite);
  if (dim === EMBEDDING_DIM) return false;

  if (dim !== null) {
    console.warn(
      `[uxie] embedding dimension changed ${dim} → ${EMBEDDING_DIM}; rebuilding vector store`,
    );
    sqlite.exec("DROP TABLE doc_vectors");
  }
  sqlite.exec(CREATE_VECTOR_TABLE);
  return dim !== null;
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

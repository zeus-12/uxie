import type Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { DESKTOP_EMBEDDING } from "@uxie/shared/lib/embedding-models";
import type { RetrievedChunk } from "@uxie/shared/lib/chat";

// Sized for whichever model the desktop embeds with — changing the model there
// changes this, so the two can no longer drift apart silently.
export const EMBEDDING_DIM = DESKTOP_EMBEDDING.dim;

const CREATE_VECTOR_TABLE = `CREATE VIRTUAL TABLE doc_vectors USING vec0(
       doc_id TEXT partition key,
       embedding FLOAT[${EMBEDDING_DIM}],
       +page_content TEXT,
       +page_number TEXT
     )`;

type ExistingSchema = { dim: number | null; hasPageNumber: boolean };

/** The relevant shape of an existing derived vector table, if it exists. */
function existingSchema(sqlite: Database.Database): ExistingSchema | null {
  const row = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE name = 'doc_vectors'")
    .get() as { sql: string } | undefined;
  if (!row) return null;
  const match = row.sql.match(/FLOAT\[(\d+)\]/i);
  return {
    dim: match ? Number(match[1]) : null,
    hasPageNumber: /\+page_number\s+TEXT/i.test(row.sql),
  };
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
  const schema = existingSchema(sqlite);
  if (schema?.dim === EMBEDDING_DIM && schema.hasPageNumber) return false;

  if (schema) {
    const reason = schema.hasPageNumber
      ? `embedding dimension changed ${schema.dim} → ${EMBEDDING_DIM}`
      : "page provenance is missing";
    console.warn(`[uxie] ${reason}; rebuilding vector store`);
    sqlite.exec("DROP TABLE doc_vectors");
  }
  sqlite.exec(CREATE_VECTOR_TABLE);
  return schema !== null;
}

export interface EmbeddedChunk extends RetrievedChunk {
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
    "INSERT INTO doc_vectors(doc_id, embedding, page_content, page_number) VALUES (?, ?, ?, ?)",
  );
  const tx = sqlite.transaction(() => {
    del.run(docId);
    for (const it of items) {
      ins.run(
        docId,
        JSON.stringify(it.embedding),
        it.pageContent,
        String(it.pageNumber),
      );
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
): RetrievedChunk[] {
  const rows = sqlite
    .prepare(
      `SELECT page_content, page_number FROM doc_vectors
       WHERE doc_id = ? AND embedding MATCH ? AND k = ?
       ORDER BY distance`,
    )
    .all(docId, JSON.stringify(embedding), k) as Array<{
    page_content: string;
    page_number: string;
  }>;
  return rows.flatMap((row): RetrievedChunk[] => {
    const pageNumber = Number(row.page_number);
    return Number.isInteger(pageNumber) && pageNumber > 0
      ? [{ pageContent: row.page_content, pageNumber }]
      : [];
  });
}

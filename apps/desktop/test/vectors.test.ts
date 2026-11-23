import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { describe, expect, it } from "vitest";
import {
  EMBEDDING_DIM,
  deleteVectors,
  hasVectors,
  initVectorStore,
  queryVectors,
  upsertVectors,
} from "../src/main/db/vectors";

// A deterministic fake embedding: a one-hot-ish vector seeded by a number, so
// "near" queries return the expected chunk without a real model.
function vec(seed: number): number[] {
  const v = new Array(EMBEDDING_DIM).fill(0);
  v[seed % EMBEDDING_DIM] = 1;
  return v;
}

function item(pageContent: string, seed: number, pageNumber = 1) {
  return {
    kind: "pdf" as const,
    pageContent,
    pageNumber,
    embedding: vec(seed),
  };
}

function freshStore() {
  const sqlite = new Database(":memory:");
  initVectorStore(sqlite);
  return sqlite;
}

describe("sqlite-vec vector store", () => {
  it("initialises the vec0 table", () => {
    const sqlite = freshStore();
    expect(hasVectors(sqlite, "doc1")).toBe(false);
  });

  it("upserts and retrieves the nearest chunk within a doc", () => {
    const sqlite = freshStore();
    upsertVectors(sqlite, "doc1", [
      item("about cats", 1, 2),
      item("about dogs", 2, 3),
      item("about fish", 3, 4),
    ]);
    expect(hasVectors(sqlite, "doc1")).toBe(true);

    const top = queryVectors(sqlite, "doc1", vec(2), 1);
    expect(top).toEqual([
      { kind: "pdf", pageContent: "about dogs", pageNumber: 3 },
    ]);
  });

  it("scopes results to the given document (partition key)", () => {
    const sqlite = freshStore();
    upsertVectors(sqlite, "doc1", [item("d1 chunk", 5, 1)]);
    upsertVectors(sqlite, "doc2", [item("d2 chunk", 5, 2)]);

    expect(queryVectors(sqlite, "doc1", vec(5), 5)).toEqual([
      { kind: "pdf", pageContent: "d1 chunk", pageNumber: 1 },
    ]);
    expect(queryVectors(sqlite, "doc2", vec(5), 5)).toEqual([
      { kind: "pdf", pageContent: "d2 chunk", pageNumber: 2 },
    ]);
  });

  it("re-vectorising replaces prior vectors", () => {
    const sqlite = freshStore();
    upsertVectors(sqlite, "doc1", [item("old", 7, 1)]);
    upsertVectors(sqlite, "doc1", [item("new", 7, 2)]);
    expect(queryVectors(sqlite, "doc1", vec(7), 5)).toEqual([
      { kind: "pdf", pageContent: "new", pageNumber: 2 },
    ]);
  });

  it("reports no rebuild for a fresh or already-correct store", () => {
    const sqlite = new Database(":memory:");
    expect(initVectorStore(sqlite)).toBe(false);
    expect(initVectorStore(sqlite)).toBe(false);
  });

  it("rebuilds and reports it when the stored dimension is stale", () => {
    const sqlite = new Database(":memory:");
    initVectorStore(sqlite);
    upsertVectors(sqlite, "doc1", [item("stale", 1)]);

    // Re-create the table at the old model's width to stand in for a DB written
    // before the embedding model changed.
    sqlite.exec("DROP TABLE doc_vectors");
    sqlite.exec(
      "CREATE VIRTUAL TABLE doc_vectors USING vec0(doc_id TEXT partition key, embedding FLOAT[384], +chunk TEXT)",
    );

    expect(initVectorStore(sqlite)).toBe(true);
    expect(hasVectors(sqlite, "doc1")).toBe(false);
    // The new table takes current-width vectors, which the stale one would reject.
    upsertVectors(sqlite, "doc1", [item("fresh", 1, 7)]);
    expect(queryVectors(sqlite, "doc1", vec(1), 1)).toEqual([
      { kind: "pdf", pageContent: "fresh", pageNumber: 7 },
    ]);
  });

  it("rebuilds a current-dimension table that has no page provenance", () => {
    const sqlite = new Database(":memory:");
    sqliteVec.load(sqlite);
    sqlite.exec(
      `CREATE VIRTUAL TABLE doc_vectors USING vec0(doc_id TEXT partition key, embedding FLOAT[${EMBEDDING_DIM}], +chunk TEXT)`,
    );

    expect(initVectorStore(sqlite)).toBe(true);
    upsertVectors(sqlite, "doc1", [item("page-aware", 4, 9)]);
    expect(queryVectors(sqlite, "doc1", vec(4), 1)).toEqual([
      { kind: "pdf", pageContent: "page-aware", pageNumber: 9 },
    ]);
  });

  it("deletes a doc's vectors", () => {
    const sqlite = freshStore();
    upsertVectors(sqlite, "doc1", [item("x", 9)]);
    deleteVectors(sqlite, "doc1");
    expect(hasVectors(sqlite, "doc1")).toBe(false);
  });
});

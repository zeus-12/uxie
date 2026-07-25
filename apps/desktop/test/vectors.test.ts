import Database from "better-sqlite3";
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
      { chunk: "about cats", embedding: vec(1) },
      { chunk: "about dogs", embedding: vec(2) },
      { chunk: "about fish", embedding: vec(3) },
    ]);
    expect(hasVectors(sqlite, "doc1")).toBe(true);

    const top = queryVectors(sqlite, "doc1", vec(2), 1);
    expect(top).toEqual(["about dogs"]);
  });

  it("scopes results to the given document (partition key)", () => {
    const sqlite = freshStore();
    upsertVectors(sqlite, "doc1", [{ chunk: "d1 chunk", embedding: vec(5) }]);
    upsertVectors(sqlite, "doc2", [{ chunk: "d2 chunk", embedding: vec(5) }]);

    expect(queryVectors(sqlite, "doc1", vec(5), 5)).toEqual(["d1 chunk"]);
    expect(queryVectors(sqlite, "doc2", vec(5), 5)).toEqual(["d2 chunk"]);
  });

  it("re-vectorising replaces prior vectors", () => {
    const sqlite = freshStore();
    upsertVectors(sqlite, "doc1", [{ chunk: "old", embedding: vec(7) }]);
    upsertVectors(sqlite, "doc1", [{ chunk: "new", embedding: vec(7) }]);
    expect(queryVectors(sqlite, "doc1", vec(7), 5)).toEqual(["new"]);
  });

  it("reports no rebuild for a fresh or already-correct store", () => {
    const sqlite = new Database(":memory:");
    expect(initVectorStore(sqlite)).toBe(false);
    expect(initVectorStore(sqlite)).toBe(false);
  });

  it("rebuilds and reports it when the stored dimension is stale", () => {
    const sqlite = new Database(":memory:");
    initVectorStore(sqlite);
    upsertVectors(sqlite, "doc1", [{ chunk: "stale", embedding: vec(1) }]);

    // Re-create the table at the old model's width to stand in for a DB written
    // before the embedding model changed.
    sqlite.exec("DROP TABLE doc_vectors");
    sqlite.exec(
      "CREATE VIRTUAL TABLE doc_vectors USING vec0(doc_id TEXT partition key, embedding FLOAT[384], +chunk TEXT)",
    );

    expect(initVectorStore(sqlite)).toBe(true);
    expect(hasVectors(sqlite, "doc1")).toBe(false);
    // The new table takes current-width vectors, which the stale one would reject.
    upsertVectors(sqlite, "doc1", [{ chunk: "fresh", embedding: vec(1) }]);
    expect(queryVectors(sqlite, "doc1", vec(1), 1)).toEqual(["fresh"]);
  });

  it("deletes a doc's vectors", () => {
    const sqlite = freshStore();
    upsertVectors(sqlite, "doc1", [{ chunk: "x", embedding: vec(9) }]);
    deleteVectors(sqlite, "doc1");
    expect(hasVectors(sqlite, "doc1")).toBe(false);
  });
});

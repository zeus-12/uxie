import { join } from "path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  LOCAL_USER_ID,
  openDatabase,
  runMigrations,
  seedLocalUser,
  type DB,
} from "../src/main/db/client";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocumentNotes,
} from "../src/main/db/documents";
import {
  addHighlight,
  deleteHighlight,
  updateAreaHighlight,
} from "../src/main/db/highlights";

const MIGRATIONS = join(__dirname, "../drizzle");

function freshDb(): DB {
  // In-memory DB migrated from the committed SQL — the same migrations the app
  // ships. Exercises the real schema, FKs, and cascades end-to-end.
  const { db } = openDatabase(":memory:");
  runMigrations(db, MIGRATIONS);
  seedLocalUser(db);
  return db;
}

function rect(over: Partial<Record<string, number>> = {}) {
  return { x1: 1, y1: 2, x2: 3, y2: 4, width: 2, height: 2, ...over };
}

describe("desktop db layer", () => {
  let db: DB;
  beforeEach(() => {
    db = freshDb();
  });

  it("seeds exactly one local user", async () => {
    seedLocalUser(db); // idempotent
    const docs = await listDocuments(db);
    expect(docs).toEqual([]);
  });

  it("creates and lists documents owned by the local user", async () => {
    const doc = await createDocument(db, {
      title: "Paper",
      url: "/local/paper.pdf",
      coverImageUrl: "/local/paper.png",
      pageCount: 12,
    });
    expect(doc.id).toBeTruthy();
    expect(doc.ownerId).toBe(LOCAL_USER_ID);
    expect(doc.isUploaded).toBe(true);
    expect(doc.lastReadPage).toBe(1);

    const list = await listDocuments(db);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Paper");
  });

  it("stores a highlight with its bounding rect and rectangles", async () => {
    const doc = await createDocument(db, {
      title: "Doc",
      url: "/x.pdf",
      coverImageUrl: "/x.png",
      pageCount: 3,
    });

    await addHighlight(db, {
      id: "hl-1",
      documentId: doc.id,
      type: "TEXT",
      pageNumber: 2,
      boundingRect: rect({ x1: 10 }),
      rects: [rect({ x1: 11 }), rect({ x1: 12 })],
    });

    const loaded = await getDocument(db, doc.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.highlights).toHaveLength(1);

    const hl = loaded!.highlights[0];
    expect(hl.id).toBe("hl-1");
    expect(hl.pageNumber).toBe(2);
    expect(hl.boundingRectangle?.x1).toBe(10);
    expect(hl.rectangles).toHaveLength(2);
    expect(hl.rectangles.map((r) => r.x1).sort()).toEqual([11, 12]);
  });

  it("updates an area highlight's bounding rectangle in place", async () => {
    const doc = await createDocument(db, {
      title: "Doc",
      url: "/x.pdf",
      coverImageUrl: "/x.png",
      pageCount: 1,
    });
    await addHighlight(db, {
      id: "hl-area",
      documentId: doc.id,
      type: "IMAGE",
      pageNumber: 1,
      boundingRect: rect({ x1: 5 }),
      rects: [],
    });

    await updateAreaHighlight(db, "hl-area", rect({ x1: 99 }));

    const loaded = await getDocument(db, doc.id);
    expect(loaded!.highlights[0].boundingRectangle?.x1).toBe(99);
  });

  it("cascades: deleting a highlight removes its coordinates", async () => {
    const doc = await createDocument(db, {
      title: "Doc",
      url: "/x.pdf",
      coverImageUrl: "/x.png",
      pageCount: 1,
    });
    await addHighlight(db, {
      id: "hl-2",
      documentId: doc.id,
      type: "TEXT",
      pageNumber: 1,
      boundingRect: rect(),
      rects: [rect()],
    });

    await deleteHighlight(db, "hl-2");

    const loaded = await getDocument(db, doc.id);
    expect(loaded!.highlights).toHaveLength(0);
  });

  it("cascades: deleting a document removes its highlights", async () => {
    const doc = await createDocument(db, {
      title: "Doc",
      url: "/x.pdf",
      coverImageUrl: "/x.png",
      pageCount: 1,
    });
    await addHighlight(db, {
      id: "hl-3",
      documentId: doc.id,
      type: "TEXT",
      pageNumber: 1,
      boundingRect: rect(),
      rects: [rect()],
    });

    await deleteDocument(db, doc.id);

    expect(await listDocuments(db)).toHaveLength(0);
    expect(await getDocument(db, doc.id)).toBeNull();
  });

  it("persists document notes", async () => {
    const doc = await createDocument(db, {
      title: "Doc",
      url: "/x.pdf",
      coverImageUrl: "/x.png",
      pageCount: 1,
    });
    await updateDocumentNotes(db, doc.id, "my notes");
    const loaded = await getDocument(db, doc.id);
    expect(loaded!.note).toBe("my notes");
  });
});

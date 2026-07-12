import { desc, eq, inArray, or } from "drizzle-orm";
import * as schema from "@uxie/shared/schema";
import type {
  CreateDocumentInput,
  Document,
  DocumentWithHighlights,
} from "@uxie/shared/schema";
import { LOCAL_USER_ID, type DB } from "./client";

/** All documents, most-recently-updated first (the library view). */
export async function listDocuments(db: DB): Promise<Document[]> {
  return db
    .select()
    .from(schema.document)
    .orderBy(desc(schema.document.updatedAt));
}

/** One document with its highlights (each with bounding rect + rectangles). */
export async function getDocument(
  db: DB,
  id: string,
): Promise<DocumentWithHighlights | null> {
  const [doc] = await db
    .select()
    .from(schema.document)
    .where(eq(schema.document.id, id));
  if (!doc) return null;

  const highlights = await db
    .select()
    .from(schema.highlight)
    .where(eq(schema.highlight.documentId, id));

  const highlightIds = highlights.map((h) => h.id);
  const coordinates = highlightIds.length
    ? await db
        .select()
        .from(schema.cordinate)
        .where(
          or(
            inArray(schema.cordinate.highlightedRectangleId, highlightIds),
            inArray(
              schema.cordinate.highlightedBoundingRectangleId,
              highlightIds,
            ),
          ),
        )
    : [];

  return {
    ...doc,
    highlights: highlights.map((h) => ({
      ...h,
      boundingRectangle:
        coordinates.find((c) => c.highlightedBoundingRectangleId === h.id) ??
        null,
      rectangles: coordinates.filter(
        (c) => c.highlightedRectangleId === h.id,
      ),
    })),
  };
}

export async function createDocument(
  db: DB,
  input: CreateDocumentInput,
): Promise<Document> {
  const [row] = await db
    .insert(schema.document)
    .values({
      title: input.title,
      url: input.url,
      coverImageUrl: input.coverImageUrl,
      pageCount: input.pageCount,
      isUploaded: input.isUploaded ?? true,
      ownerId: LOCAL_USER_ID,
    })
    .returning();
  return row;
}

export async function updateDocumentNotes(
  db: DB,
  id: string,
  note: string,
): Promise<void> {
  await db
    .update(schema.document)
    .set({ note })
    .where(eq(schema.document.id, id));
}

export async function updateLastReadPage(
  db: DB,
  id: string,
  lastReadPage: number,
): Promise<void> {
  await db
    .update(schema.document)
    .set({ lastReadPage })
    .where(eq(schema.document.id, id));
}

export async function updateDocumentTitle(
  db: DB,
  id: string,
  title: string,
): Promise<void> {
  await db
    .update(schema.document)
    .set({ title })
    .where(eq(schema.document.id, id));
}

/** Delete a document; highlights/messages/flashcards cascade (FK ON DELETE). */
export async function deleteDocument(db: DB, id: string): Promise<void> {
  await db.delete(schema.document).where(eq(schema.document.id, id));
}

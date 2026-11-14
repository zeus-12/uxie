import { and, desc, eq, isNull } from "drizzle-orm";
import * as schema from "@uxie/shared/schema";
import type { Bookmark, CreateBookmarkInput } from "@uxie/shared/schema";
import type { DB } from "./client";

export async function listBookmarks(
  db: DB,
  documentId: string,
): Promise<Bookmark[]> {
  return db
    .select()
    .from(schema.bookmark)
    .where(eq(schema.bookmark.documentId, documentId))
    .orderBy(desc(schema.bookmark.createdAt));
}

export async function createBookmark(
  db: DB,
  input: CreateBookmarkInput,
): Promise<Bookmark> {
  // A page can have many passage bookmarks, but repeated clicks on the page
  // action should converge on one page-only bookmark.
  if (input.location == null) {
    const [existing] = await db
      .select()
      .from(schema.bookmark)
      .where(
        and(
          eq(schema.bookmark.documentId, input.documentId),
          eq(schema.bookmark.pageNumber, input.pageNumber),
          isNull(schema.bookmark.location),
        ),
      );
    if (existing) return existing;
  }

  const [row] = await db
    .insert(schema.bookmark)
    .values({
      documentId: input.documentId,
      pageNumber: input.pageNumber,
      label: input.label ?? null,
      location: input.location ?? null,
    })
    .returning();
  return row;
}

export async function renameBookmark(
  db: DB,
  id: string,
  label: string | null,
): Promise<Bookmark> {
  const [row] = await db
    .update(schema.bookmark)
    .set({ label })
    .where(eq(schema.bookmark.id, id))
    .returning();
  if (!row) throw new Error("Bookmark not found");
  return row;
}

export async function deleteBookmark(db: DB, id: string): Promise<void> {
  await db.delete(schema.bookmark).where(eq(schema.bookmark.id, id));
}

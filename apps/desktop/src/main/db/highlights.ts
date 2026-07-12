import { eq } from "drizzle-orm";
import * as schema from "@uxie/shared/schema";
import type { AddHighlightInput, RectInput } from "@uxie/shared/schema";
import type { DB } from "./client";

function cordinateValues(rect: RectInput) {
  return {
    x1: rect.x1,
    y1: rect.y1,
    x2: rect.x2,
    y2: rect.y2,
    width: rect.width,
    height: rect.height,
    pageNumber: rect.pageNumber ?? null,
  };
}

/**
 * Create a highlight together with its single bounding rectangle and its many
 * rectangles, atomically. The client supplies the highlight `id` so it matches
 * the id react-pdf-highlighter uses in the reader.
 */
export async function addHighlight(
  db: DB,
  input: AddHighlightInput,
): Promise<void> {
  const highlightPageNumber =
    input.pageNumber ?? input.boundingRect.pageNumber ?? null;

  db.transaction((tx) => {
    tx.insert(schema.highlight)
      .values({
        id: input.id,
        type: input.type,
        documentId: input.documentId,
        pageNumber: highlightPageNumber,
      })
      .run();

    tx.insert(schema.cordinate)
      .values({
        ...cordinateValues(input.boundingRect),
        highlightedBoundingRectangleId: input.id,
      })
      .run();

    if (input.rects.length > 0) {
      tx.insert(schema.cordinate)
        .values(
          input.rects.map((rect) => ({
            ...cordinateValues(rect),
            highlightedRectangleId: input.id,
          })),
        )
        .run();
    }
  });
}

/** Delete a highlight; its bounding rect + rectangles cascade (FK ON DELETE). */
export async function deleteHighlight(db: DB, id: string): Promise<void> {
  await db.delete(schema.highlight).where(eq(schema.highlight.id, id));
}

/** Update the bounding rectangle of an (area) highlight in place. */
export async function updateAreaHighlight(
  db: DB,
  id: string,
  boundingRect: RectInput,
): Promise<void> {
  await db
    .update(schema.cordinate)
    .set(cordinateValues(boundingRect))
    .where(eq(schema.cordinate.highlightedBoundingRectangleId, id));
}

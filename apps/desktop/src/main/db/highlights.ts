import { eq } from "drizzle-orm";
import * as schema from "@uxie/shared/schema";
import type { AddHighlightInput, RectInput } from "@uxie/shared/schema";
import type { DB } from "./client";

function rectColumns(rect: RectInput) {
  return {
    x1: rect.x1,
    y1: rect.y1,
    x2: rect.x2,
    y2: rect.y2,
    width: rect.width,
    height: rect.height,
  };
}

export async function addHighlight(
  db: DB,
  input: AddHighlightInput,
): Promise<void> {
  const pageNumber =
    input.pageNumber ?? input.boundingRect.pageNumber ?? null;

  db.transaction((tx) => {
    tx.insert(schema.highlight)
      .values({
        id: input.id,
        type: input.type,
        documentId: input.documentId,
        pageNumber,
      })
      .run();

    tx.insert(schema.cordinate)
      .values({
        ...rectColumns(input.boundingRect),
        pageNumber: input.boundingRect.pageNumber ?? null,
        highlightedBoundingRectangleId: input.id,
      })
      .run();

    if (input.rects.length > 0) {
      tx.insert(schema.cordinate)
        .values(
          input.rects.map((rect) => ({
            ...rectColumns(rect),
            pageNumber: rect.pageNumber ?? null,
            highlightedRectangleId: input.id,
          })),
        )
        .run();
    }
  });
}

export async function deleteHighlight(db: DB, id: string): Promise<void> {
  await db.delete(schema.highlight).where(eq(schema.highlight.id, id));
}

// Only updates supplied fields — an omitted pageNumber is left untouched
// rather than nulled.
export async function updateAreaHighlight(
  db: DB,
  id: string,
  boundingRect: RectInput,
): Promise<void> {
  await db
    .update(schema.cordinate)
    .set({
      ...rectColumns(boundingRect),
      ...(boundingRect.pageNumber != null
        ? { pageNumber: boundingRect.pageNumber }
        : {}),
    })
    .where(eq(schema.cordinate.highlightedBoundingRectangleId, id));
}

import { z } from "zod";
import { MAX_BOOKMARK_PASSAGE_LENGTH } from "@uxie/shared/lib/bookmarks";
import type {
  CreateBookmarkInput,
  PdfPassageAnchor,
} from "@uxie/shared/schema";

const idSchema = z.string().trim().min(1);

const rectSchema = z.object({
  x1: z.number().finite(),
  y1: z.number().finite(),
  x2: z.number().finite(),
  y2: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  pageNumber: z.number().int().positive().nullable().optional(),
});

const exactTextSchema = z.string().trim().min(1).max(MAX_BOOKMARK_PASSAGE_LENGTH);

const passageAnchorSchema: z.ZodType<PdfPassageAnchor> = z.discriminatedUnion(
  "kind",
  [
    z.object({
      version: z.literal(1),
      kind: z.literal("quote"),
      exact: exactTextSchema,
    }),
    z.object({
      version: z.literal(1),
      kind: z.literal("selection"),
      exact: exactTextSchema,
      position: z.object({
        boundingRect: rectSchema,
        rects: z.array(rectSchema).min(1),
      }),
    }),
  ],
);

const labelSchema = z
  .union([z.string().trim().max(80), z.null()])
  .transform((label) => label || null);

const createBookmarkInputSchema: z.ZodType<CreateBookmarkInput> = z
  .object({
    documentId: idSchema,
    pageNumber: z.number().int().positive(),
    label: labelSchema.optional(),
    location: passageAnchorSchema.nullable().optional(),
  })
  .superRefine((bookmark, context) => {
    if (bookmark.location?.kind !== "selection") return;
    const rects = [
      bookmark.location.position.boundingRect,
      ...bookmark.location.position.rects,
    ];
    if (
      rects.some(
        (rect) =>
          rect.pageNumber != null && rect.pageNumber !== bookmark.pageNumber,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["location", "position"],
        message: "Selection geometry must be on the bookmark page",
      });
    }
  });

export const parseBookmarkId = (input: unknown): string =>
  idSchema.parse(input);

export const parseBookmarkLabel = (input: unknown): string | null =>
  labelSchema.parse(input);

export const parseCreateBookmarkInput = (input: unknown): CreateBookmarkInput =>
  createBookmarkInputSchema.parse(input);

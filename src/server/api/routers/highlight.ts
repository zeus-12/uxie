import { z, custom } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { HighlightPositionTypeWithDocumentId } from "@/lib/types";

export const highlightRouter = createTRPCRouter({
  add: protectedProcedure
    .input(
      // maybe replace with zod types
      custom<HighlightPositionTypeWithDocumentId>(),
    )
    .mutation(async ({ ctx, input }) => {
      const content: any = {};
      // make this cleaner
      if ("text" in input.content) {
        content["text"] = input.content.text;
      } else if ("image" in input.content) {
        content["imageUrl"] = input.content.image;
      } else {
        throw new Error("Invalid content type");
      }

      const pageNumber =
        typeof input.boundingRect.pageNumber === "number" &&
        !isNaN(input.boundingRect.pageNumber)
          ? { pageNumber: input.boundingRect.pageNumber }
          : {};

      await ctx.prisma.highlight.create({
        data: {
          boundingRectangle: {
            create: {
              x1: input.boundingRect.x1,
              y1: input.boundingRect.y1,
              x2: input.boundingRect.x2,
              y2: input.boundingRect.y2,
              width: input.boundingRect.width,
              height: input.boundingRect.height,
              pageNumber,
            },
          },
          pageNumber,
          rectangles: {
            createMany: {
              data: input.rects.map((rect) => ({
                x1: rect.x1,
                y1: rect.y1,
                x2: rect.x2,
                y2: rect.y2,
                width: rect.width,
                height: rect.height,
                ...(typeof rect.pageNumber === "number" &&
                !isNaN(rect.pageNumber)
                  ? { pageNumber: rect.pageNumber }
                  : {}),
              })),
            },
          },
          document: {
            connect: {
              id: input.documentId,
            },
          },
          ...content,
        },
      });
    }),
});

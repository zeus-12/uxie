import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const highlightRouter = createTRPCRouter({
  add: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        id: z.string(),
        boundingRect: z.object({
          x1: z.number(),
          y1: z.number(),
          x2: z.number(),
          y2: z.number(),
          width: z.number(),
          height: z.number(),
          pageNumber: z.number().optional(),
        }),
        rects: z.array(
          z.object({
            x1: z.number(),
            y1: z.number(),
            x2: z.number(),
            y2: z.number(),
            width: z.number(),
            height: z.number(),
            pageNumber: z.number().optional(),
          }),
        ),
        pageNumber: z.number(),

        content: z.object({
          text: z.string().optional(),
          image: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const content: any = {};
      //TODO make this cleaner
      // if ("text" in input.content) {
      //   content["text"] = input.content.text;
      // } else if ("image" in input.content) {
      //   //TODO upload this base64 image to somewhere and store the link to db
      //   content["imageUrl"] = input.content.image;
      // } else {
      //   throw new Error("Invalid content type");
      // }

      const pageNumber =
        typeof input.boundingRect.pageNumber === "number" &&
        !isNaN(input.boundingRect.pageNumber)
          ? { pageNumber: input.boundingRect.pageNumber }
          : {};

      await ctx.prisma.highlight.create({
        data: {
          id: input.id,
          boundingRectangle: {
            create: {
              x1: input.boundingRect.x1,
              y1: input.boundingRect.y1,
              x2: input.boundingRect.x2,
              y2: input.boundingRect.y2,
              width: input.boundingRect.width,
              height: input.boundingRect.height,
              ...pageNumber,
            },
          },
          ...pageNumber,
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

      return true;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        highlightId: z.string(),
        documentId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUnique({
        where: {
          id: input.documentId,
          ownerId: ctx.session.user.id,
        },
      });

      if (!doc) {
        throw new Error("Document not found");
      }

      await ctx.prisma.highlight.delete({
        where: {
          id: input.highlightId,
          documentId: input.documentId,
        },
      });

      return true;
    }),
});

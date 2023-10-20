import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const documentRouter = createTRPCRouter({
  getDocData: protectedProcedure
    .input(
      z.object({
        docId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const res = await ctx.prisma.document.findUnique({
        where: {
          id: input.docId,
          OR: [
            { ownerId: ctx.session.user.id },
            {
              collaborators: {
                some: {
                  userId: ctx.session.user.id,
                },
              },
            },
          ],
        },

        include: {
          highlights: {
            include: {
              boundingRectangle: true,
              rectangles: true,
            },
          },
          owner: true,
          collaborators: true,
          messages: true,
        },
      });

      if (!res) return null;

      const highlightData = res.highlights.map((highlight) => ({
        ...(highlight.text
          ? { content: { text: highlight.text } }
          : { content: { image: highlight.imageUrl } }),
        id: highlight.id,
        position: {
          boundingRect: {
            id: highlight.boundingRectangle?.id!,
            x1: highlight.boundingRectangle?.x1!,
            y1: highlight.boundingRectangle?.y1!,
            x2: highlight.boundingRectangle?.x2!,
            y2: highlight.boundingRectangle?.y2!,
            width: highlight.boundingRectangle?.width!,
            height: highlight.boundingRectangle?.height!,
            pageNumber: highlight.boundingRectangle?.pageNumber!,
          },
          rects: highlight.rectangles.map((rect) => ({
            id: rect.id,
            x1: rect.x1,
            y1: rect.y1,
            x2: rect.x2,
            y2: rect.y2,
            width: rect.width,
            height: rect.height,
            pageNumber: rect.pageNumber,
          })),
          pageNumber: highlight.pageNumber,
        },
      }));

      return {
        id: res.id,
        title: res.title,
        highlights: highlightData!,
        owner: res.owner,
        collaborators: res.collaborators,
        messages: res.messages,
      };
    }),
});

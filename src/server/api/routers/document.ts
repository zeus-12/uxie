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

      const highlightData = res?.highlights.map((highlight) => ({
        ...(highlight.text
          ? { content: { text: highlight.text } }
          : { content: { image: highlight.imageUrl } }),
        id: highlight.id,
        position: {
          boundingRect: highlight.boundingRectangle,
          rects: highlight.rectangles,
          pageNumber: highlight.pageNumber,
        },
      }));

      return {
        id: res?.id,
        title: res?.title,
        highlights: highlightData,
        owner: res?.owner,
        collaborators: res?.collaborators,
        messages: res?.messages,
      };
    }),
});

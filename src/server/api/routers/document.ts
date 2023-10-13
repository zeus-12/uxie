import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";

export const documentRouter = createTRPCRouter({
  getDocData: protectedProcedure
    .input(
      z.object({
        docId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.document.findUnique({
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

      // if (!res) {
      //   throw new Error("Document not found");
      // }

      // const modifiedHighlights: IHighlight[] = res.highlights.map(
      //   (highlight) => ({
      //     content: {
      //       text:,
      //       image:
      //     },
      //     id: highlight.id,
      //     position: {
      //       boundingRect: highlight.boundingRect,

      //     }
      //   }),
      // );
    }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});

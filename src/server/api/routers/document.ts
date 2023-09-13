import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { IHighlight } from "react-pdf-highlighter";

export const documentRouter = createTRPCRouter({
  // hello: publicProcedure
  //   .input(z.object({ text: z.string() }))
  //   .query(({ input }) => {
  //     return {
  //       greeting: `Hello ${input.text}`,
  //     };
  //   }),

  getUsersDocs: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.user.findUnique({
      where: {
        id: ctx?.session?.user?.id,
      },
      include: {
        collaborators: true,
        documents: true,
      },
    });

    console.log("user", res);
  }),
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
              user: true,
            },
          },
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

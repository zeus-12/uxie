import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";

export const documentRouter = createTRPCRouter({
  // hello: publicProcedure
  //   .input(z.object({ text: z.string() }))
  //   .query(({ input }) => {
  //     return {
  //       greeting: `Hello ${input.text}`,
  //     };
  //   }),

  getUsersDocs: protectedProcedure.query(async ({ ctx }) => {
    const [userUploadedDocs, userCollaboratedDocs] =
      await ctx.prisma.$transaction([
        ctx.prisma.document.findMany({
          where: {
            ownerId: ctx?.session?.user.id,
          },
        }),

        ctx.prisma.document.findMany({
          where: {
            collaborators: {
              some: {
                id: ctx?.session?.user.id,
              },
            },
          },
        }),
      ]);

    return {
      userUploadedDocs,
      userCollaboratedDocs,
    };
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
      });
    }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});

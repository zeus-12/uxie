import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const messageRouter = createTRPCRouter({
  getAllByDocId: protectedProcedure
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
        select: {
          messages: true,
        },
      });

      return res?.messages?.map((c) => ({
        id: c.id,
        content: c.text,
        role: c.isUserMessage ? "user" : "assistant",
      }));
    }),
});

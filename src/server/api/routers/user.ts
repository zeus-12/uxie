import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";

export const userRouter = createTRPCRouter({
  getUsersDocs: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.user.findUnique({
      where: {
        id: ctx?.session?.user?.id,
      },
      include: {
        documents: {
          include: {
            collaborators: true,
          },
        },
        collaboratorateddocuments: {
          include: {
            document: true,
          },
        },
      },
    });
  }),
});

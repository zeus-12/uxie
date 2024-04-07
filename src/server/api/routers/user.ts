import { feedbackFormSchema } from "@/lib/utils";
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
  submitFeedback: publicProcedure
    .input(feedbackFormSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.feedback.create({
        data: {
          message: input.message,
          type: input.type,
          ...(input.email ? { contact_email: input.email } : {}),
          ...(ctx?.session?.user?.id
            ? {
                user: {
                  connect: {
                    id: ctx?.session?.user?.id,
                  },
                },
              }
            : {}),
        },
      });
    }),
});

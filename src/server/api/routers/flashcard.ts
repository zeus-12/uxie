import { generateFlashcards as generateFlashcardsHelper } from "@/lib/flashcard";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { prisma } from "@/server/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const flashcardRouter = createTRPCRouter({
  getFlashcards: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const res = await ctx.prisma.document.findUnique({
        where: {
          id: input.documentId,
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
          flashcards: {
            select: {
              answer: true,
              question: true,
              id: true,
              flashcardAttempts: {
                select: {
                  userResponse: true,
                  correctResponse: true,
                  incorrectResponse: true,
                  moreInfo: true,
                  createdAt: true,
                  // include user? (since all collabs can see attempts, it'll be better to include user info)
                },
              },
            },
          },
        },
      });

      if (!res) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Document not found or you do not have access to it.",
        });
      }

      if (res.flashcards.length === 0) {
        return [];
      }

      return res.flashcards;
    }),

  generateFlashcards: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        // pages: z.array(z.number()),
        // numberOfQuestions: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.prisma.document.findUnique({
        where: {
          id: input.documentId,
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
          url: true,
        },
      });

      if (!res) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Document not found or you do not have access to it.",
        });
      }

      const flashcards = await generateFlashcardsHelper(res.url);

      const final = await prisma.flashcard.createMany({
        data: flashcards.map((flashcard) => ({
          question: flashcard.question,
          answer: flashcard.answer,
          documentId: input.documentId,
        })),
      });

      return final;
    }),
});

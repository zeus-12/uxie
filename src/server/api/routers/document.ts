import { vectoriseDocument } from "@/lib/vectorise";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { CollaboratorRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

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
          collaborators: {
            include: {
              user: true,
            },
          },
          messages: true,
        },
      });

      if (!res) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Document not found or you do not have access to it.",
        });
      }

      const highlightData = res.highlights.map((highlight) => ({
        id: highlight.id,
        position: {
          boundingRect: {
            id: highlight.boundingRectangle?.id,
            x1: highlight.boundingRectangle?.x1,
            y1: highlight.boundingRectangle?.y1,
            x2: highlight.boundingRectangle?.x2,
            y2: highlight.boundingRectangle?.y2,
            width: highlight.boundingRectangle?.width,
            height: highlight.boundingRectangle?.height,
            pageNumber: highlight.boundingRectangle?.pageNumber,
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

      const collaborator = res.collaborators.find(
        (c) => c.userId === ctx.session.user.id,
      );

      const isOwner = res.owner.id === ctx.session.user.id;
      const canEdit = isOwner || collaborator?.role === CollaboratorRole.EDITOR;
      const username = isOwner ? res.owner.name : collaborator?.user.name || "";

      return {
        id: res.id,
        title: res.title,
        highlights: highlightData!,
        owner: res.owner,
        collaborators: res.collaborators,
        messages: res.messages,
        url: res.url,
        isVectorised: res.isVectorised,
        userPermissions: {
          canEdit,
          username,
          isOwner: res.owner.id === ctx.session.user.id,
        },
      };
    }),

  addCollaborator: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        data: z.object({
          email: z.string(),
          role: z.nativeEnum(CollaboratorRole),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const doc = await ctx.prisma.document.findUnique({
          where: {
            id: input.documentId,
            ownerId: ctx.session.user.id,
          },
        });

        if (!doc) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Document not found or you do not have access to it.",
          });
        }

        const user = await ctx.prisma.user.findUnique({
          where: {
            email: input.data.email,
          },
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found.",
          });
        }

        await ctx.prisma.collaborator.create({
          data: {
            role: input.data.role,
            documentId: input.documentId,
            userId: user.id,
          },
        });

        return true;
      } catch (err: any) {
        console.log(err.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message,
        });
      }
    }),

  removeCollaboratorById: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const doc = await ctx.prisma.document.findUnique({
          where: {
            id: input.documentId,
            ownerId: ctx.session.user.id,
          },
        });

        if (!doc) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Document not found or you do not have access to it.",
          });
        }

        await ctx.prisma.collaborator.delete({
          where: {
            documentId_userId: {
              documentId: input.documentId,
              userId: input.userId,
            },
          },
        });

        return true;
      } catch (err: any) {
        console.log(err.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message,
        });
      }
    }),

  getCollaborators: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUnique({
        where: {
          id: input.documentId,
          ownerId: ctx.session.user.id,
        },
        select: {
          collaborators: {
            select: {
              role: true,
              user: {
                select: {
                  email: true,
                  id: true,
                },
              },
            },
          },
          owner: {
            select: {
              email: true,
              id: true,
            },
          },
        },
      });

      if (!doc) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Document not found or you are not the owner.",
        });
      }
      return [
        {
          email: doc.owner.email ?? "Invalid Email",
          role: CollaboratorRole.OWNER,
          id: doc.owner.id,
        },
        ...doc.collaborators.map((cur) => ({
          email: cur.user.email ?? "Invalid Email",
          role: cur.role,
          id: cur.user.id,
        })),
      ];
    }),

  vectorise: protectedProcedure
    .input(
      z.object({
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
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Document not found or you are not the owner.",
        });
      }

      if (doc.isVectorised) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Document already vectorised.",
        });
      }

      try {
        await vectoriseDocument(doc.url, doc.id);
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message,
        });
      }

      return true;
    }),
  addDocumentByLink: protectedProcedure
    .input(
      z.object({
        url: z.string(),
        title: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const newFile = await ctx.prisma.document.create({
          data: {
            title: input.title,
            url: input.url,
            isUploaded: false,
            owner: {
              connect: {
                id: ctx.session.user.id,
              },
            },
          },
        });

        // nested try-catch to not throw error if vectorisation fails
        try {
          await vectoriseDocument(input.url, newFile.id);
          return newFile;
        } catch (err: any) {
          console.log(err.message);
        }
      } catch (err: any) {
        console.log(err.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message,
        });
      }
    }),
});

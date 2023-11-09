import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { CollaboratorRole } from "@prisma/client";

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
        url: res.url,
        isVectorised: res.isVectorised,
      };
    }),

  getDocsDetails: protectedProcedure
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
          collaborators: {
            // this might be expensive, would be better to fetch userdetails as a transaction
            include: {
              user: true,
            },
          },
          owner: true,
        },
      });

      if (!res) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Document not found or you do not have access to it.",
        });
      }

      let canEdit = false;
      let username = "";
      if (res?.owner.id === ctx.session.user.id) {
        canEdit = true;
        username = res.owner.name;
      } else {
        for (const collaborator of res.collaborators) {
          if (collaborator.userId === ctx.session.user.id) {
            username = collaborator.user.name;
            if (collaborator.role === CollaboratorRole.EDITOR) {
              canEdit = true;
            }
            break;
          }
        }
      }

      return {
        canEdit,
        username,
        isOwner: res.owner.id === ctx.session.user.id,
      };
    }),

  // getNotesData: protectedProcedure
  //   .input(z.object({ docId: z.string() }))
  //   .query(async ({ ctx, input }) => {
  // const res = await ctx.prisma.document.findUnique({
  //   where: {
  //     id: input.docId,
  //     OR: [
  //       { ownerId: ctx.session.user.id },
  //       {
  //         collaborators: {
  //           some: {
  //             userId: ctx.session.user.id,
  //           },
  //         },
  //       },
  //     ],
  //   },

  //   include: {
  //     collaborators: {
  //       // this might be expensive, would be better to fetch userdetails as a transaction
  //       include: {
  //         user: true,
  //       },
  //     },
  //     owner: true,
  //   },
  // });

  // if (!res) {
  //   throw new TRPCError({
  //     code: "UNAUTHORIZED",
  //     message: "Document not found or you do not have access to it.",
  //   });
  // }

  // let canEdit = false;
  // let username = "";
  // if (res?.owner.id === ctx.session.user.id) {
  //   canEdit = true;
  //   username = res.owner.name;
  // } else {
  //   for (const collaborator of res.collaborators) {
  //     if (collaborator.userId === ctx.session.user.id) {
  //       username = collaborator.user.name;
  //       if (collaborator.role === CollaboratorRole.EDITOR) {
  //         canEdit = true;
  //       }
  //       break;
  //     }
  //   }
  //     }

  //     return {
  //       initialNotes: res.note,
  //       canEdit,
  //       username,
  //     };
  //   }),
  // updateNotes: protectedProcedure
  //   .input(
  //     z.object({
  //       markdown: z.string(),
  //       documentId: z.string(),
  //     }),
  //   )
  //   .mutation(async ({ ctx, input }) => {
  //     const doc = await ctx.prisma.document.findUnique({
  //       where: {
  //         id: input.documentId,
  //         OR: [
  //           { ownerId: ctx.session.user.id },
  //           {
  //             collaborators: {
  //               some: {
  //                 userId: ctx.session.user.id,
  //                 role: CollaboratorRole.EDITOR,
  //               },
  //             },
  //           },
  //         ],
  //       },
  //     });

  //     if (!doc) {
  //       throw new TRPCError({
  //         code: "UNAUTHORIZED",
  //         message: "Document not found or you do not have access to it.",
  //       });
  //     }

  //     await ctx.prisma.document.update({
  //       data: {
  //         note: input.markdown,
  //       },
  //       where: {
  //         id: input.documentId,
  //       },
  //     });

  //     return true;
  //   }),

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
            documentId: input.documentId,
            userId: input.userId,
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
});

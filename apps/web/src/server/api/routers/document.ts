import { PLANS, fileSizeBytes } from "@/lib/constants";
import { generateAndUploadCover } from "@/lib/pdf-cover";
import { stripTextFromEnd } from "@/lib/utils";
import { vectoriseDocument } from "@/lib/vectorise";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { extractArticle } from "@/server/article/extract";
import {
  ArticleFetchError,
  fetchPublicResource,
} from "@/server/article/safe-fetch";
import {
  ArticleIngestionStatus,
  CollaboratorRole,
  DocumentKind,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
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
              articleAnchor: true,
            },
          },
          article: {
            include: {
              snapshots: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
          articleProgress: {
            where: { userId: ctx.session.user.id },
            take: 1,
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

      const highlightData = res.highlights
        .filter((highlight) => highlight.type !== "ARTICLE_TEXT")
        .map((highlight) => ({
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
      const common = {
        id: res.id,
        title: res.title,
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
        note: res.note,
      };

      if (res.kind === DocumentKind.ARTICLE) {
        const snapshot = res.article?.snapshots[0];
        if (!res.article || !snapshot) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "This article is missing its reader snapshot.",
          });
        }

        return {
          ...common,
          kind: "article" as const,
          article: {
            canonicalUrl: res.article.canonicalUrl,
            sourceUrl: res.article.sourceUrl,
            siteName: res.article.siteName,
            byline: res.article.byline,
            excerpt: res.article.excerpt,
            wordCount: res.article.wordCount,
            snapshot: {
              id: snapshot.id,
              title: snapshot.title,
              contentHtml: snapshot.contentHtml,
              textContent: snapshot.textContent,
              contentHash: snapshot.contentHash,
            },
          },
          highlights: res.highlights.flatMap((highlight) => {
            const anchor = highlight.articleAnchor;
            if (highlight.type !== "ARTICLE_TEXT" || !anchor) return [];
            return [
              {
                id: highlight.id,
                selectedText: highlight.selectedText ?? anchor.exactText,
                anchor: {
                  snapshotId: anchor.snapshotId,
                  blockId: anchor.blockId,
                  startOffset: anchor.startOffset,
                  endOffset: anchor.endOffset,
                  prefix: anchor.prefix,
                  suffix: anchor.suffix,
                  exactText: anchor.exactText,
                },
              },
            ];
          }),
          progress: res.articleProgress[0]
            ? {
                snapshotId: res.articleProgress[0].snapshotId,
                blockId: res.articleProgress[0].blockId,
                characterOffset: res.articleProgress[0].characterOffset,
                scrollFraction: res.articleProgress[0].scrollFraction,
              }
            : null,
        };
      }

      return {
        ...common,
        kind: "pdf" as const,
        highlights: highlightData,
        pageCount: res.pageCount,
        lastReadPage: res.lastReadPage,
        zoomLevel: res.zoomLevel,
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
        select: {
          owner: {
            select: {
              plan: true,
            },
          },
          isVectorised: true,
          url: true,
          id: true,
          kind: true,
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

      const docOwnerPlan = doc.owner.plan;
      const maxPagesAllowed = PLANS[docOwnerPlan].maxPagesPerDoc;

      try {
        await vectoriseDocument({
          fileUrl: doc.url,
          documentId: doc.id,
          maxPagesAllowed,
          maxFileBytes: fileSizeBytes(PLANS[docOwnerPlan].maxFileSizeMbPerDoc),
          kind: doc.kind,
        });
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
        url: z.string().url(),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await ctx.prisma.user.findUnique({
          where: {
            id: ctx.session.user.id,
          },
          select: {
            plan: true,
            _count: {
              select: {
                documents: true,
              },
            },
          },
        });

        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User not found.",
          });
        }

        const docCount = user._count.documents;
        const docOwnerPlan = user.plan;
        const maxPagesAllowed = PLANS[docOwnerPlan].maxPagesPerDoc;

        if (docCount >= PLANS[user.plan].maxDocs) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "You have reached the maximum number of documents allowed. Please upgrade your plan to add more documents.",
          });
        }

        const resource = await fetchPublicResource({
          inputUrl: input.url,
          maxBytes: fileSizeBytes(PLANS[user.plan].maxFileSizeMbPerDoc),
        });

        if (resource.contentType.includes("application/pdf")) {
          const arrayBuffer = resource.body.buffer.slice(
            resource.body.byteOffset,
            resource.body.byteOffset + resource.body.byteLength,
          );
          const blob = new Blob([arrayBuffer], { type: "application/pdf" });
          const loader = new PDFLoader(blob);
          const pageLevelDocs = await loader.load();
          const numPages = pageLevelDocs.length;
          const sourceTitle =
            input.title ||
            new URL(resource.finalUrl).pathname.split("/").pop() ||
            "Untitled";
          const coverImageUrl = await generateAndUploadCover(
            arrayBuffer,
            sourceTitle,
          );

          return ctx.prisma.document.create({
            data: {
              title: stripTextFromEnd(sourceTitle, ".pdf"),
              url: resource.finalUrl,
              isUploaded: false,
              pageCount: numPages,
              coverImageUrl: coverImageUrl ?? "",
              owner: { connect: { id: ctx.session.user.id } },
            },
          });
        }

        if (
          !resource.contentType.includes("text/html") &&
          !resource.contentType.includes("application/xhtml+xml")
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This URL is not a PDF or a readable web page.",
          });
        }

        const article = extractArticle({
          html: new TextDecoder().decode(resource.body),
          url: resource.finalUrl,
        });

        return ctx.prisma.document.create({
          data: {
            kind: DocumentKind.ARTICLE,
            title: article.title,
            url: input.url,
            isUploaded: false,
            pageCount: 0,
            coverImageUrl: article.coverImageUrl,
            owner: { connect: { id: ctx.session.user.id } },
            article: {
              create: {
                sourceUrl: input.url,
                canonicalUrl: article.canonicalUrl,
                siteName: article.siteName,
                byline: article.byline,
                excerpt: article.excerpt,
                wordCount: article.wordCount,
                status: ArticleIngestionStatus.READY,
                snapshots: {
                  create: {
                    title: article.title,
                    contentHtml: article.contentHtml,
                    textContent: article.textContent,
                    contentHash: article.contentHash,
                  },
                },
              },
            },
          },
        });
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        const message =
          error instanceof ArticleFetchError || error instanceof Error
            ? error.message
            : "The URL could not be imported.";
        throw new TRPCError({
          code:
            error instanceof ArticleFetchError && error.kind === "failed"
              ? "INTERNAL_SERVER_ERROR"
              : "BAD_REQUEST",
          message,
        });
      }
    }),

  updateNotes: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        note: z.string(),
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

      await ctx.prisma.document.update({
        where: {
          id: input.documentId,
        },
        data: {
          note: input.note,
        },
      });

      return true;
    }),

  // Where the reader left off. Both fields are optional so a zoom change
  // doesn't have to rewrite the page (or vice versa) — each is debounced and
  // written on its own.
  updateReaderState: protectedProcedure
    .input(
      z.object({
        docId: z.string(),
        lastReadPage: z.number().optional(),
        zoomLevel: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUnique({
        where: {
          id: input.docId,
          ownerId: ctx.session.user.id,
        },
      });

      if (!doc) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Document not found or you are not the owner.",
        });
      }

      await ctx.prisma.document.update({
        where: {
          id: input.docId,
        },
        data: {
          ...(input.lastReadPage !== undefined && {
            lastReadPage: input.lastReadPage,
          }),
          ...(input.zoomLevel !== undefined && { zoomLevel: input.zoomLevel }),
        },
      });

      return true;
    }),

  updateArticleProgress: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        snapshotId: z.string(),
        blockId: z.string().nullable(),
        characterOffset: z.number().int().nonnegative(),
        scrollFraction: z.number().min(0).max(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.prisma.document.findFirst({
        where: {
          id: input.documentId,
          kind: DocumentKind.ARTICLE,
          OR: [
            { ownerId: ctx.session.user.id },
            { collaborators: { some: { userId: ctx.session.user.id } } },
          ],
          article: {
            snapshots: { some: { id: input.snapshotId } },
          },
        },
        select: { id: true },
      });

      if (!document) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Article not found or you do not have access to it.",
        });
      }

      await ctx.prisma.articleProgress.upsert({
        where: {
          documentId_userId: {
            documentId: input.documentId,
            userId: ctx.session.user.id,
          },
        },
        create: {
          documentId: input.documentId,
          userId: ctx.session.user.id,
          snapshotId: input.snapshotId,
          blockId: input.blockId,
          characterOffset: input.characterOffset,
          scrollFraction: input.scrollFraction,
        },
        update: {
          snapshotId: input.snapshotId,
          blockId: input.blockId,
          characterOffset: input.characterOffset,
          scrollFraction: input.scrollFraction,
        },
      });

      return true;
    }),

  updateTitle: protectedProcedure
    .input(
      z.object({
        docId: z.string(),
        title: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUnique({
        where: {
          id: input.docId,
          OR: [
            { ownerId: ctx.session.user.id },
            {
              collaborators: {
                some: {
                  userId: ctx.session.user.id,
                  role: CollaboratorRole.EDITOR,
                },
              },
            },
          ],
        },
      });

      if (!doc) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Document not found or you do not have permission to edit.",
        });
      }

      await ctx.prisma.document.update({
        where: {
          id: input.docId,
        },
        data: {
          title: input.title,
        },
      });

      return true;
    }),
});

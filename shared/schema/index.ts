/**
 * The desktop app's local database schema — a faithful 1:1 mirror of the web
 * app's `apps/web/prisma/schema.prisma`, expressed as Drizzle SQLite tables.
 *
 * Why mirror the FULL schema (auth/collab/plan tables included) when the
 * single-user desktop app only exercises a subset? So a future Prisma→Drizzle
 * convergence yields ONE shared source of truth. Table and column names are
 * kept identical to Prisma on purpose.
 *
 * Postgres→SQLite fidelity notes:
 *   - Prisma enums        → text() with an `enum` union (typed, stored as text)
 *   - Boolean             → integer(mode: "boolean")
 *   - DateTime            → integer(mode: "timestamp")  (Unix seconds)
 *   - Float               → real()
 *   - Json                → text(mode: "json")
 *   - cuid() id defaults  → generated in app code via @paralleldrive/cuid2
 */
import { relations } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const PLANS = ["FREE", "FREE_PLUS", "PRO"] as const;
export const COLLABORATOR_ROLES = ["EDITOR", "VIEWER", "OWNER"] as const;
export const HIGHLIGHT_TYPES = ["TEXT", "IMAGE"] as const;

// Shared column builders. Each call returns a fresh builder instance.
const primaryId = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => createId());

const createdAt = () =>
  integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date());

// ── User / auth ──────────────────────────────────────────────────────

export const user = sqliteTable("User", {
  id: primaryId(),
  name: text("name").notNull(),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp" }),
  image: text("image"),
  createdAt: createdAt(),
  plan: text("plan", { enum: PLANS }).notNull().default("FREE"),
});

export const account = sqliteTable(
  "Account",
  {
    id: primaryId(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    providerUnique: uniqueIndex(
      "Account_provider_providerAccountId_key",
    ).on(t.provider, t.providerAccountId),
  }),
);

// ── Documents ────────────────────────────────────────────────────────

export const document = sqliteTable("Document", {
  id: primaryId(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  ownerId: text("ownerId")
    .notNull()
    .references(() => user.id),
  note: text("note"),
  isVectorised: integer("isVectorised", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: createdAt(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  pageCount: integer("pageCount").notNull(),
  // false if the user added the document by URL
  isUploaded: integer("isUploaded", { mode: "boolean" })
    .notNull()
    .default(true),
  lastReadPage: integer("lastReadPage").notNull().default(1),
  coverImageUrl: text("coverImageUrl").notNull(),
  summary: text("summary"),
});

export const collaborator = sqliteTable(
  "Collaborator",
  {
    id: primaryId(),
    role: text("role", { enum: COLLABORATOR_ROLES }).notNull(),
    documentId: text("documentId")
      .notNull()
      .references(() => document.id),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
  },
  (t) => ({
    documentUserUnique: uniqueIndex(
      "Collaborator_documentId_userId_key",
    ).on(t.documentId, t.userId),
  }),
);

export const message = sqliteTable("Message", {
  id: primaryId(),
  createdAt: createdAt(),
  userId: text("userId").references(() => user.id),
  documentId: text("documentId")
    .notNull()
    .references(() => document.id, { onDelete: "cascade" }),
  parts: text("parts", { mode: "json" }),
});

// ── Highlights ───────────────────────────────────────────────────────

export const highlight = sqliteTable("Highlight", {
  id: primaryId(),
  type: text("type", { enum: HIGHLIGHT_TYPES }).notNull(),
  documentId: text("documentId")
    .notNull()
    .references(() => document.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  pageNumber: integer("pageNumber"),
});

export const cordinate = sqliteTable(
  "Cordinate",
  {
    id: primaryId(),
    x1: real("x1").notNull(),
    y1: real("y1").notNull(),
    x2: real("x2").notNull(),
    y2: real("y2").notNull(),
    width: real("width").notNull(),
    height: real("height").notNull(),
    pageNumber: integer("pageNumber"),
    // A highlight's many text/area rectangles.
    highlightedRectangleId: text("highlightedRectangleId").references(
      () => highlight.id,
      { onDelete: "cascade" },
    ),
    // A highlight's single bounding rectangle (1:1).
    highlightedBoundingRectangleId: text(
      "highlightedBoundingRectangleId",
    ).references(() => highlight.id, { onDelete: "cascade" }),
  },
  (t) => ({
    boundingUnique: uniqueIndex(
      "Cordinate_highlightedBoundingRectangleId_key",
    ).on(t.highlightedBoundingRectangleId),
  }),
);

// ── Feedback / flashcards ────────────────────────────────────────────

export const feedback = sqliteTable("Feedback", {
  id: primaryId(),
  message: text("message").notNull(),
  contact_email: text("contact_email"),
  type: text("type").notNull(),
  createdAt: createdAt(),
  userId: text("userId").references(() => user.id),
});

export const flashcard = sqliteTable("Flashcard", {
  id: primaryId(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  documentId: text("documentId")
    .notNull()
    .references(() => document.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const flashcardAttempt = sqliteTable("FlashcardAttempt", {
  id: primaryId(),
  flashcardId: text("flashcardId")
    .notNull()
    .references(() => flashcard.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  createdAt: createdAt(),
  userResponse: text("userResponse").notNull(),
  correctResponse: text("correctResponse"),
  incorrectResponse: text("incorrectResponse"),
  moreInfo: text("moreInfo"),
});

// ── Relations (Drizzle relational-query API) ─────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  documents: many(document),
  messages: many(message),
  collaborators: many(collaborator),
  feedbacks: many(feedback),
  flashcardAttempts: many(flashcardAttempt),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const documentRelations = relations(document, ({ one, many }) => ({
  owner: one(user, { fields: [document.ownerId], references: [user.id] }),
  highlights: many(highlight),
  collaborators: many(collaborator),
  messages: many(message),
  flashcards: many(flashcard),
}));

export const collaboratorRelations = relations(collaborator, ({ one }) => ({
  document: one(document, {
    fields: [collaborator.documentId],
    references: [document.id],
  }),
  user: one(user, { fields: [collaborator.userId], references: [user.id] }),
}));

export const messageRelations = relations(message, ({ one }) => ({
  document: one(document, {
    fields: [message.documentId],
    references: [document.id],
  }),
  user: one(user, { fields: [message.userId], references: [user.id] }),
}));

export const highlightRelations = relations(highlight, ({ one }) => ({
  document: one(document, {
    fields: [highlight.documentId],
    references: [document.id],
  }),
  // NOTE: Highlight↔Cordinate is intentionally NOT modeled as Drizzle relations.
  // Cordinate has two FKs to Highlight (highlightedBoundingRectangleId +
  // highlightedRectangleId), which forces relationName-based disambiguation; the
  // inverse-`one` side (a highlight's single bounding rect) then hits a bug in
  // drizzle's `one()` (`config?.fields.reduce` throws when a config has a
  // relationName but no fields). The main-process query layer assembles a
  // highlight's boundingRectangle + rectangles with explicit queries instead
  // (see src/main/db/documents.ts).
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(user, { fields: [feedback.userId], references: [user.id] }),
}));

export const flashcardRelations = relations(flashcard, ({ one, many }) => ({
  document: one(document, {
    fields: [flashcard.documentId],
    references: [document.id],
  }),
  flashcardAttempts: many(flashcardAttempt),
}));

export const flashcardAttemptRelations = relations(
  flashcardAttempt,
  ({ one }) => ({
    flashcard: one(flashcard, {
      fields: [flashcardAttempt.flashcardId],
      references: [flashcard.id],
    }),
    user: one(user, {
      fields: [flashcardAttempt.userId],
      references: [user.id],
    }),
  }),
);

// ── Inferred types ───────────────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type Document = typeof document.$inferSelect;
export type NewDocument = typeof document.$inferInsert;
export type Highlight = typeof highlight.$inferSelect;
export type Cordinate = typeof cordinate.$inferSelect;
export type Message = typeof message.$inferSelect;
export type Flashcard = typeof flashcard.$inferSelect;
export type FlashcardAttempt = typeof flashcardAttempt.$inferSelect;

export type Plan = (typeof PLANS)[number];
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];
export type HighlightType = (typeof HIGHLIGHT_TYPES)[number];

// ── DTOs shared by the IPC contract and the main-process query layer ──

/** A single rectangle's geometry (mirrors react-pdf-highlighter's shape). */
export interface RectInput {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber?: number | null;
}

/** The client provides the highlight `id` (react-pdf-highlighter generates it). */
export interface AddHighlightInput {
  id: string;
  documentId: string;
  type: HighlightType;
  pageNumber?: number | null;
  boundingRect: RectInput;
  rects: RectInput[];
}

export interface CreateDocumentInput {
  title: string;
  url: string;
  coverImageUrl: string;
  pageCount: number;
  isUploaded?: boolean;
}

export type HighlightWithRects = Highlight & {
  boundingRectangle: Cordinate | null;
  rectangles: Cordinate[];
};

export type DocumentWithHighlights = Document & {
  highlights: HighlightWithRects[];
};

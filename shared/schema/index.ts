// Local SQLite schema — a 1:1 mirror of apps/web/prisma/schema.prisma so a
// future Prisma→Drizzle convergence has one source of truth. The desktop app
// only exercises documents + highlights; the rest is kept for parity.
// Prisma→SQLite: enum→text, bool→int, DateTime→int timestamp, Float→real,
// Json→text, cuid()→cuid2 (app-side).
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

const primaryId = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => createId());

const createdAt = () =>
  integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

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
    providerUnique: uniqueIndex("Account_provider_providerAccountId_key").on(
      t.provider,
      t.providerAccountId,
    ),
  }),
);

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
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  pageCount: integer("pageCount").notNull(),
  isUploaded: integer("isUploaded", { mode: "boolean" }).notNull().default(true),
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
    documentUserUnique: uniqueIndex("Collaborator_documentId_userId_key").on(
      t.documentId,
      t.userId,
    ),
  }),
);

export const message = sqliteTable("Message", {
  id: primaryId(),
  createdAt: createdAt(),
  userId: text("userId").references(() => user.id, { onDelete: "set null" }),
  documentId: text("documentId")
    .notNull()
    .references(() => document.id, { onDelete: "cascade" }),
  parts: text("parts", { mode: "json" }),
});

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
    highlightedRectangleId: text("highlightedRectangleId").references(
      () => highlight.id,
      { onDelete: "cascade" },
    ),
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

export const feedback = sqliteTable("Feedback", {
  id: primaryId(),
  message: text("message").notNull(),
  contact_email: text("contact_email"),
  type: text("type").notNull(),
  createdAt: createdAt(),
  userId: text("userId").references(() => user.id, { onDelete: "set null" }),
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

export interface RectInput {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber?: number | null;
}

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

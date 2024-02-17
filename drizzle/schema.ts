import { pgTable, uniqueIndex, foreignKey, pgEnum, text, integer, doublePrecision, timestamp, boolean, varchar } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const collaboratorRole = pgEnum("CollaboratorRole", ['EDITOR', 'VIEWER', 'OWNER'])
export const highlightTypeEnum = pgEnum("HighlightTypeEnum", ['TEXT', 'IMAGE'])


export const account = pgTable("Account", {
	id: text("id").primaryKey().notNull(),
	userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	type: text("type").notNull(),
	provider: text("provider").notNull(),
	providerAccountId: text("providerAccountId").notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	expiresAt: integer("expires_at"),
	tokenType: text("token_type"),
	scope: text("scope"),
	idToken: text("id_token"),
	sessionState: text("session_state"),
},
(table) => {
	return {
		providerProviderAccountIdKey: uniqueIndex("Account_provider_providerAccountId_key").on(table.provider, table.providerAccountId),
	}
});

export const cordinate = pgTable("Cordinate", {
	id: text("id").primaryKey().notNull(),
	x1: doublePrecision("x1").notNull(),
	y1: doublePrecision("y1").notNull(),
	x2: doublePrecision("x2").notNull(),
	y2: doublePrecision("y2").notNull(),
	width: doublePrecision("width").notNull(),
	height: doublePrecision("height").notNull(),
	pageNumber: integer("pageNumber"),
	highlightedRectangleId: text("highlightedRectangleId").references(() => highlight.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	highlightedBoundingRectangleId: text("highlightedBoundingRectangleId").references(() => highlight.id, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => {
	return {
		highlightedBoundingRectangleIdKey: uniqueIndex("Cordinate_highlightedBoundingRectangleId_key").on(table.highlightedBoundingRectangleId),
	}
});

export const message = pgTable("Message", {
	id: text("id").primaryKey().notNull(),
	text: text("text").notNull(),
	createdAt: timestamp("createdAt", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	userId: text("userId").references(() => user.id, { onDelete: "set null", onUpdate: "cascade" } ),
	documentId: text("documentId").notNull().references(() => document.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	isUserMessage: boolean("isUserMessage").notNull(),
});

export const collaborator = pgTable("Collaborator", {
	id: text("id").primaryKey().notNull(),
	documentId: text("documentId").notNull().references(() => document.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	userId: text("userId").notNull().references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	role: collaboratorRole("role").notNull(),
},
(table) => {
	return {
		documentIdUserIdKey: uniqueIndex("Collaborator_documentId_userId_key").on(table.documentId, table.userId),
	}
});

export const document = pgTable("Document", {
	url: text("url").notNull(),
	id: text("id").primaryKey().notNull(),
	title: text("title").notNull(),
	ownerId: text("ownerId").notNull().references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	note: text("note"),
	isVectorised: boolean("isVectorised").default(false).notNull(),
	createdAt: timestamp("createdAt", { precision: 3, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		urlKey: uniqueIndex("Document_url_key").on(table.url),
	}
});

export const highlight = pgTable("Highlight", {
	id: text("id").primaryKey().notNull(),
	documentId: text("documentId").notNull().references(() => document.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	pageNumber: integer("pageNumber"),
	type: highlightTypeEnum("type").notNull(),
	createdAt: timestamp("createdAt", { precision: 3, mode: 'string' }).defaultNow().notNull(),
});

export const user = pgTable("User", {
	id: text("id").primaryKey().notNull(),
	name: text("name").notNull(),
	email: text("email"),
	image: text("image"),
	emailVerified: timestamp("emailVerified", { precision: 3, mode: 'string' }),
	createdAt: timestamp("createdAt", { precision: 3, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		emailKey: uniqueIndex("User_email_key").on(table.email),
	}
});

export const feedback = pgTable("Feedback", {
	id: text("id").primaryKey().notNull(),
	message: text("message").notNull(),
	type: text("type").notNull(),
	createdAt: timestamp("createdAt", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	userId: text("userId").references(() => user.id, { onDelete: "set null", onUpdate: "cascade" } ),
	contactEmail: text("contact_email"),
});

export const flashcard = pgTable("Flashcard", {
	id: text("id").primaryKey().notNull(),
	question: text("question").notNull(),
	answer: text("answer").notNull(),
	documentId: text("documentId").notNull().references(() => document.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	createdAt: timestamp("createdAt", { precision: 3, mode: 'string' }).defaultNow().notNull(),
});

export const flashcardAttempt = pgTable("FlashcardAttempt", {
	id: text("id").primaryKey().notNull(),
	flashcardId: text("flashcardId").notNull().references(() => flashcard.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	userId: text("userId").notNull().references(() => user.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	createdAt: timestamp("createdAt", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	userResponse: text("userResponse").notNull(),
	correctResponse: text("correctResponse"),
	incorrectResponse: text("incorrectResponse"),
	moreInfo: text("moreInfo"),
});

export const prismaMigrations = pgTable("_prisma_migrations", {
	id: varchar("id", { length: 36 }).primaryKey().notNull(),
	checksum: varchar("checksum", { length: 64 }).notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: text("logs"),
	rolledBackAt: timestamp("rolled_back_at", { withTimezone: true, mode: 'string' }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
});
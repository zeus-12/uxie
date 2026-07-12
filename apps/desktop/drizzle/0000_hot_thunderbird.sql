CREATE TABLE `Account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Account_provider_providerAccountId_key` ON `Account` (`provider`,`providerAccountId`);--> statement-breakpoint
CREATE TABLE `Collaborator` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`documentId` text NOT NULL,
	`userId` text NOT NULL,
	FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Collaborator_documentId_userId_key` ON `Collaborator` (`documentId`,`userId`);--> statement-breakpoint
CREATE TABLE `Cordinate` (
	`id` text PRIMARY KEY NOT NULL,
	`x1` real NOT NULL,
	`y1` real NOT NULL,
	`x2` real NOT NULL,
	`y2` real NOT NULL,
	`width` real NOT NULL,
	`height` real NOT NULL,
	`pageNumber` integer,
	`highlightedRectangleId` text,
	`highlightedBoundingRectangleId` text,
	FOREIGN KEY (`highlightedRectangleId`) REFERENCES `Highlight`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`highlightedBoundingRectangleId`) REFERENCES `Highlight`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Cordinate_highlightedBoundingRectangleId_key` ON `Cordinate` (`highlightedBoundingRectangleId`);--> statement-breakpoint
CREATE TABLE `Document` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`ownerId` text NOT NULL,
	`note` text,
	`isVectorised` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`pageCount` integer NOT NULL,
	`isUploaded` integer DEFAULT true NOT NULL,
	`lastReadPage` integer DEFAULT 1 NOT NULL,
	`coverImageUrl` text NOT NULL,
	`summary` text,
	FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`contact_email` text,
	`type` text NOT NULL,
	`createdAt` integer NOT NULL,
	`userId` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `Flashcard` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`documentId` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `FlashcardAttempt` (
	`id` text PRIMARY KEY NOT NULL,
	`flashcardId` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`userResponse` text NOT NULL,
	`correctResponse` text,
	`incorrectResponse` text,
	`moreInfo` text,
	FOREIGN KEY (`flashcardId`) REFERENCES `Flashcard`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Highlight` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`documentId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`pageNumber` integer,
	FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Message` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`userId` text,
	`documentId` text NOT NULL,
	`parts` text,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`emailVerified` integer,
	`image` text,
	`createdAt` integer NOT NULL,
	`plan` text DEFAULT 'FREE' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_email_unique` ON `User` (`email`);
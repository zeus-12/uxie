CREATE TABLE `Bookmark` (
	`id` text PRIMARY KEY NOT NULL,
	`documentId` text NOT NULL,
	`pageNumber` integer NOT NULL,
	`label` text,
	`location` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `Bookmark_documentId_createdAt_idx` ON `Bookmark` (`documentId`,`createdAt`);
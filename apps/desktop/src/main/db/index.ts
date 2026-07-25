import { app } from "electron";
import { join } from "path";
import type Database from "better-sqlite3";
import * as schema from "@uxie/shared/schema";
import { openDatabase, runMigrations, seedLocalUser, type DB } from "./client";
import { initVectorStore } from "./vectors";

let db: DB | null = null;
let sqlite: Database.Database | null = null;

/** Where the generated migrations live at runtime (bundled via extraResources). */
function migrationsFolder(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "drizzle")
    : // dev: out/main → apps/desktop/drizzle
      join(__dirname, "../../drizzle");
}

/**
 * A rebuilt vector store has no vectors in it, so a document still flagged as
 * vectorised would show its chat as ready and then retrieve nothing. Clear the
 * flag so those documents offer to index again.
 */
function clearVectorisedFlags(db: DB): void {
  db.update(schema.document).set({ isVectorised: false }).run();
}

/**
 * Open the local DB in the OS app-data dir, apply migrations, and seed the local
 * user. Idempotent — safe to call once at startup. Must run before any IPC
 * handler touches the database.
 */
export function initDatabase(): DB {
  if (db) return db;
  const filePath = join(app.getPath("userData"), "uxie.db");
  console.log(`[uxie] SQLite DB: ${filePath}`);
  const opened = openDatabase(filePath);
  runMigrations(opened.db, migrationsFolder());
  seedLocalUser(opened.db);
  if (initVectorStore(opened.sqlite)) clearVectorisedFlags(opened.db);
  db = opened.db;
  sqlite = opened.sqlite;
  return db;
}

export function getDb(): DB {
  if (!db) {
    throw new Error("Database not initialised — call initDatabase() first");
  }
  return db;
}

export function getSqlite(): Database.Database {
  if (!sqlite) {
    throw new Error("Database not initialised — call initDatabase() first");
  }
  return sqlite;
}

export * from "./documents";
export * from "./highlights";

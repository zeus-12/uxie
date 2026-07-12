import { app } from "electron";
import { join } from "path";
import { openDatabase, runMigrations, seedLocalUser, type DB } from "./client";

let db: DB | null = null;

/** Where the generated migrations live at runtime (bundled via extraResources). */
function migrationsFolder(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "drizzle")
    : // dev: out/main → apps/desktop/drizzle
      join(__dirname, "../../drizzle");
}

/**
 * Open the local DB in the OS app-data dir, apply migrations, and seed the local
 * user. Idempotent — safe to call once at startup. Must run before any IPC
 * handler touches the database.
 */
export function initDatabase(): DB {
  if (db) return db;
  const filePath = join(app.getPath("userData"), "uxie.db");
  const opened = openDatabase(filePath);
  runMigrations(opened.db, migrationsFolder());
  seedLocalUser(opened.db);
  db = opened.db;
  return db;
}

export function getDb(): DB {
  if (!db) {
    throw new Error("Database not initialised — call initDatabase() first");
  }
  return db;
}

export * from "./documents";
export * from "./highlights";

import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@uxie/shared/schema";

export type DB = BetterSQLite3Database<typeof schema>;

/**
 * The single local user. The desktop app is single-user, but the schema mirrors
 * the multi-user web app 1:1 (see shared/schema), so every `ownerId`/`userId`
 * FK points at this seeded row rather than the schema diverging.
 */
export const LOCAL_USER_ID = "local-user";

/** Open (or create) the SQLite database at `filePath` and wrap it with Drizzle. */
export function openDatabase(filePath: string): {
  db: DB;
  sqlite: Database.Database;
} {
  const sqlite = new Database(filePath);
  // WAL for concurrent reads; foreign_keys must be ON for our ON DELETE CASCADE
  // rules to actually fire (SQLite defaults it OFF per-connection).
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

/** Apply the generated migrations in `migrationsFolder` (idempotent). */
export function runMigrations(db: DB, migrationsFolder: string): void {
  migrate(db, { migrationsFolder });
}

/** Ensure the single local user row exists so owner FKs are satisfiable. */
export function seedLocalUser(db: DB): void {
  db.insert(schema.user)
    .values({ id: LOCAL_USER_ID, name: "Me" })
    .onConflictDoNothing()
    .run();
}

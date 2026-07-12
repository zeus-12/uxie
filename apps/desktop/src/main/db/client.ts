import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@uxie/shared/schema";

export type DB = BetterSQLite3Database<typeof schema>;

// The desktop app is single-user; every ownerId/userId FK points here.
export const LOCAL_USER_ID = "local-user";

export function openDatabase(filePath: string): {
  db: DB;
  sqlite: Database.Database;
} {
  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  // Required for our ON DELETE CASCADE rules to fire (off by default).
  sqlite.pragma("foreign_keys = ON");
  return { db: drizzle(sqlite, { schema }), sqlite };
}

export function runMigrations(db: DB, migrationsFolder: string): void {
  migrate(db, { migrationsFolder });
}

export function seedLocalUser(db: DB): void {
  db.insert(schema.user)
    .values({ id: LOCAL_USER_ID, name: "Me" })
    .onConflictDoNothing()
    .run();
}

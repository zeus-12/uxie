import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import type { DB } from "./types";

const dialect = new PostgresDialect({
  pool: new Pool({
    database: "uxie",
    host: "localhost",
    user: "vishnu",
    port: 5432,
    max: 10,
  }),
});

export const db = new Kysely<DB>({
  dialect,
});

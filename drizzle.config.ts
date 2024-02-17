import type { Config } from "drizzle-kit";
import "dotenv/config";
import { env } from "@/env.mjs";

export default {
  driver: "pg",

  dbCredentials: {
    connectionString: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
} satisfies Config;

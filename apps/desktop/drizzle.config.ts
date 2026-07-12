import { defineConfig } from "drizzle-kit";

// Migrations are GENERATED from the shared schema (never hand-written), emitted
// to ./drizzle, committed, shipped as an electron-builder extraResource, and
// applied at startup by src/main/db/client.ts.
export default defineConfig({
  dialect: "sqlite",
  schema: "../../shared/schema/index.ts",
  out: "./drizzle",
});

import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@uxie/shared": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["__tests__/**/*.test.ts"],
  },
});

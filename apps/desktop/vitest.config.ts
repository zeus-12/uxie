import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@uxie/shared": resolve(__dirname, "../../shared"),
    },
  },
  test: {
    environment: "node",
  },
});

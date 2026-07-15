import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    // Bundle (don't externalize): @uxie/shared is workspace TS source, and the
    // AI SDK is ESM-only (@ai-sdk/openai-compatible) — Node can't require either
    // from the CJS main bundle. Bundling also keeps a single copy of the AI SDK
    // so models flow into streamText correctly. Native/CJS deps (better-sqlite3,
    // drizzle-orm, etc.) stay external.
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          "@uxie/shared",
          "ai",
          "@ai-sdk/openai-compatible",
          "zod",
          // Bundled because it's pulled in via @uxie/shared but isn't a direct
          // dependency of the desktop app, so a runtime require wouldn't resolve.
          "@langchain/textsplitters",
        ],
      }),
    ],
    resolve: {
      alias: {
        "@uxie/shared": resolve(__dirname, "../../shared"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        "@uxie/shared": resolve(__dirname, "../../shared"),
        "@": resolve(__dirname, "src/renderer"),
      },
    },
    plugins: [react()],
    css: {
      postcss: resolve(__dirname, "postcss.config.mjs"),
    },
    build: {
      // Electron ships a modern Chromium, so skip legacy transpilation/polyfills.
      target: "esnext",
    },
  },
});

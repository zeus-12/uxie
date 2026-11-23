import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { THEME_BOOTSTRAP_SCRIPT } from "../../shared/lib/theme";

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
    plugins: [
      react(),
      {
        name: "uxie-theme-bootstrap",
        transformIndexHtml: () => [
          {
            tag: "script",
            children: THEME_BOOTSTRAP_SCRIPT,
            injectTo: "head-prepend",
          },
        ],
      },
    ],
    // scribe imports its native canvas binding only when `process` exists, which the
    // sandboxed renderer and its workers don't have, so it must not be bundled.
    optimizeDeps: { exclude: ["scribe.js-ocr"] },
    worker: {
      format: "es",
      rollupOptions: { external: ["@scribe.js/canvas"] },
    },
    css: {
      postcss: resolve(__dirname, "postcss.config.mjs"),
    },
    build: {
      // Electron ships a modern Chromium, so skip legacy transpilation/polyfills.
      target: "esnext",
      rollupOptions: { external: ["@scribe.js/canvas"] },
    },
  },
});

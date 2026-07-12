import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    // @uxie/shared is TypeScript source in the workspace — bundle it into main
    // rather than externalizing it (Node can't require its .ts at runtime).
    // Everything else (better-sqlite3 native addon, drizzle-orm, etc.) stays
    // external and loads from node_modules.
    plugins: [externalizeDepsPlugin({ exclude: ["@uxie/shared"] })],
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

# @uxie/desktop

The local-first Uxie desktop app. For what Uxie is and how the monorepo fits together,
see the [root README](../../README.md).

Everything stays on your machine: PDFs, notes, highlights, embeddings. The only thing that
leaves is whatever you send to the LLM endpoint you configure — point it at a local Ollama
and nothing leaves at all.

## Stack

- **Electron 35** + **electron-vite** (main / preload / renderer)
- **SQLite** (`better-sqlite3`) via **Drizzle**, schema shared from `@uxie/shared/schema`
- **sqlite-vec** for vector search, **transformers.js** (`Xenova/bge-base-en-v1.5`, the
  same model the web app uses) for embeddings — both run in-process, no server
- **Vercel AI SDK** against any **OpenAI-compatible** endpoint, with native tool-calling
  for agentic RAG
- **react-pdf-highlighter**, **Tailwind v4**, **Radix**
- UI components shared from `@uxie/shared`

## Running it

From the repo root, after `pnpm install`:

```bash
pnpm dev:desktop
```

`predev` rebuilds `better-sqlite3` against Electron's ABI first — that step is required,
because npm installs a plain-Node build.

No accounts or API keys are needed to start. On first run, open **Settings** and give it an
LLM endpoint:

| Field     | Example                       |
| --------- | ----------------------------- |
| Base URL  | `http://localhost:11434/v1`   |
| Model     | `llama3.1`                    |
| API key   | optional — blank for local    |

Anything OpenAI-compatible works (Ollama, LM Studio, llama.cpp's server, a proxy, or a
hosted API). Until it's set, AI features fail with *"LLM not configured — set a base URL
and model in Settings."* Reading, highlighting and notes all work without it.

The API key is encrypted at rest with the OS keychain via Electron `safeStorage`, falling
back to plaintext on systems without one.

### The native-module trap

`pnpm --filter @uxie/desktop test` runs `pretest`, which rebuilds `better-sqlite3` for
**plain Node** so Vitest can load it. That undoes the Electron rebuild. After running
tests, before `pnpm dev:desktop`:

```bash
pnpm --filter @uxie/desktop run rebuild
```

Otherwise Electron throws a `NODE_MODULE_VERSION` mismatch on startup.

## Where your data lives

`~/Library/Application Support/Uxie/` (dev builds use `.../@uxie/desktop/`, derived from
the package name):

```
uxie.db          SQLite — documents, highlights, notes, flashcards, messages, vectors
documents/       imported PDFs, by id
covers/          generated page-1 thumbnails
settings.json    LLM endpoint; API key sealed via safeStorage
```

Delete that folder to reset the app completely.

## Architecture notes

- **Process split.** The main process owns the DB, the filesystem and LLM generation
  (so streaming works over IPC). The renderer owns the DOM, PDF rendering, and the
  embedding worker — transformers.js needs a real worker, and rasterising a cover needs a
  real `<canvas>`.
- **IPC is fully typed.** `src/ipc-contract.ts` declares every channel, its args and its
  result exactly once; preload and main derive from those maps mechanically. Add a channel
  there, not in three places.
- **PDFs are served over a custom protocol.** Bytes on disk aren't reachable from the
  sandboxed renderer, and pdf.js wants a URL. The main process registers `uxie-pdf://`
  (`src/main/pdf.ts`), so `uxie-pdf://doc/<id>` streams a PDF and `uxie-pdf://cover/<id>`
  a thumbnail. A document row's `url` column stores that URL directly.
- **Migrations** are generated (`pnpm --filter @uxie/desktop db:generate` — never
  hand-written), committed under `drizzle/`, shipped as `extraResources`, and applied at
  startup from `process.resourcesPath/drizzle` in packaged builds.
- **No usage limits.** Unlike the web app there are no plan caps: every chunk of a document
  is indexed and every chunk can produce flashcards. Inference is yours, so a long book
  just takes longer.
- **Vectors are derived data.** `initVectorStore` reads the existing table's dimension and
  rebuilds it if the embedding model changed, rather than failing on every insert.
  Documents are re-vectorised on next use.
- **The embedding dtype is pinned to `q8`** in `shared/lib/embeddings.ts`. Don't remove it:
  transformers.js picks a default from the detected device, and on a `cpu` device that's
  `fp32` — a 436MB download that runs 2.6× slower than the 110MB `q8` build. Measured on
  an M-series Mac: `q8` ≈ 141 ms/chunk, `fp32` ≈ 373 ms/chunk.

## Scripts

Run via `pnpm --filter @uxie/desktop <script>`:

| Script          | What it does                                        |
| --------------- | --------------------------------------------------- |
| `dev`           | electron-vite dev (with `predev` native rebuild)     |
| `build`         | Bundle main/preload/renderer into `out/`             |
| `typecheck`     | Node + renderer tsconfigs                            |
| `test`          | Vitest (rebuilds native module for Node — see above) |
| `rebuild`       | Rebuild `better-sqlite3` for Electron                |
| `db:generate`   | Generate a Drizzle migration from the shared schema  |
| `pack` / `pack:dmg` | Local unsigned macOS build → `dist/`             |

## Packaging

`electron-builder.yml` targets **macOS arm64, DMG only**. Two things it gets right that are
easy to break:

- `sqlite-vec` is `asarUnpack`ed — it's a loadable `.dylib` and must be a real file on disk.
- `npmRebuild: false` — native modules are rebuilt explicitly, since electron-builder's own
  rebuild path is flaky under pnpm.

Builds are **unsigned** (no Apple Developer ID), so first launch needs right-click → Open,
or `xattr -dr com.apple.quarantine /Applications/Uxie.app`.

To cut a release, see the root README — `pnpm release <version>` from a clean `main`.

The app icon is generated from `shared/assets/brand/app-icon.svg` via
`bash scripts/generate-icons.sh`.

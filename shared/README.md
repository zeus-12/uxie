# @uxie/shared

Code shared between `apps/web` (Next.js) and `apps/desktop` (Electron).

Planned contents as the desktop migration proceeds:

- **`schema/`** — the Drizzle schema (a faithful 1:1 mirror of the web app's
  `prisma/schema.prisma`), so a future Prisma→Drizzle convergence yields a
  single source of truth. Desktop uses SQLite (`sqliteTable`); the web app is
  untouched for now.
- **`validators/`** — shared Zod validators and TypeScript domain types both
  apps conform to.
- **`ai/`** — the LLM provider factory (OpenAI-compatible / Ollama endpoint)
  and the local embedding-model runner (transformers.js).
- **`components/`** — shared UI, if/when the two apps share React components.

Nothing here is wired up yet — this package is scaffolded so the workspace
resolves. See the desktop migration plan for the full phasing.

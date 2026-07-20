# Uxie — notes for agents

## Layout

- `apps/web` — Next.js (Pages Router + some App Router API routes). Postgres/Prisma, tRPC, NextAuth, hosted AI.
- `apps/desktop` — Electron (electron-vite). SQLite/Drizzle, sqlite-vec, local embeddings, user-supplied LLM endpoint.
- `shared/` — UI components and logic used by both. Abstract here rather than duplicating.

Run things from the root: `pnpm dev:web`, `pnpm dev:desktop`, `pnpm typecheck`.

## Rules

- Align before changing: check the code, explain the fix, wait for my OK — unless trivial.
- Never commit or push without my explicit approval — every time.
- Default to `main`; no PRs or new branches unless I ask.
- To find TypeScript errors run `pnpm typecheck`, never a full build.
- Never hand-write migrations. Update the schema, then generate (`pnpm --filter @uxie/desktop db:generate`).

## Gotchas

- `apps/web/src/components/demo` + `apps/web/src/lib/demo` are the local `/demo` (fully client-side,
  no backend). When adding a web reader feature, wire it into the demo if it makes sense — skip
  anything server/AI/DB/auth/collab.

# @uxie/shared

Code shared between `apps/web` (Next.js) and `apps/desktop` (Electron). Currently imported
by ~10 files in web and ~23 in desktop.

Not published — consumed as `workspace:*` and compiled by each app (web via
`transpilePackages`, desktop via Vite). Import paths map to the file tree:
`@uxie/shared/lib/chat`, `@uxie/shared/components/chat`, `@uxie/shared/schema`.

## Contents

| Path          | What's in it                                                                     |
| ------------- | -------------------------------------------------------------------------------- |
| `components/` | The reader, notes editor, chat panel, flashcards, sidebar, workspace and `ui/` primitives |
| `hooks/`      | PDF reader state, sentence/RSVP reading, local + browser TTS                      |
| `lib/`        | Prompts, chat tool definitions, flashcard parsing, embeddings, TTS engines, zustand stores |
| `schema/`     | The Drizzle SQLite schema (desktop's DB) and shared Zod validators                 |
| `types/`      | Editor and pdf.js type declarations                                               |
| `assets/`     | Brand SVGs and fonts                                                              |

## Constraints

- **Stay platform-neutral.** No `next/*`, `next-auth`, or `process.env`. Anything a
  component needs from the host app (an API base, a save callback, a router push) comes in
  as a prop or an injected function.
- **Zod only for schemas.** Web is on `ai@6`-era packages and desktop on `ai@7`; sharing
  AI-SDK types across that gap doesn't work, so `lib/chat.ts` exposes plain Zod.
- **Browser globals need care.** `lib/tts`, `lib/utils` and `hooks/use-browser-tts` touch
  `navigator` / `window`. Fine in the Electron renderer, but they'll throw during Next SSR
  if imported at module scope.
- **`schema/` is desktop's database.** It's Drizzle/SQLite; the web app is Prisma/Postgres.
  The types exported here do not match web's Prisma types — don't type shared components
  against them if web has to render them too.
- **Both apps embed with the same model** (`lib/embedding-models.ts`) — web via the HF API,
  desktop on-device. `lib/embeddings.ts` is the desktop-only local path; its `dtype: "q8"`
  is pinned deliberately, see `apps/desktop/README.md`.

## Known drift

A number of components and libs here still exist as separate copies inside `apps/web/src`,
and the two have diverged. Before editing a file here, check whether web has its own copy
that also needs the change. See `docs/code-quality.md` at the repo root for the inventory.

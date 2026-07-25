# @uxie/web

The hosted Uxie web app. For what Uxie is and how the monorepo fits together, see the
[root README](../../README.md).

## Stack

- **Next.js** (Pages Router, plus App Router handlers under `src/app/api`) + **tRPC** + **Zod**
- **Supabase** Postgres via **Prisma**
- **NextAuth** (Google provider)
- **Uploadthing** for PDF storage
- **Pinecone** for embeddings, **Hugging Face** (`BAAI/bge-base-en-v1.5`) to generate them
- **Google Gemini** via the Vercel AI SDK + **Langchain** for chat, flashcards and summaries
- **Blocknote** for notes, **react-pdf-highlighter** for the reader
- **Liveblocks** for realtime collaboration
- **Tailwind** + **shadcn/Radix**, **React Query**, **React Hook Form**, **nuqs**

## Setup

From the repo root, after `pnpm install`:

```bash
cp apps/web/.env.example apps/web/.env
```

> **The `.env` must live in `apps/web/`, not the repo root.** Next only reads env files
> from the app root, and `src/env.mjs` validates them at boot — a missing var fails
> `pnpm dev:web` immediately with a list of what's absent.

Fill in the values (`.env.example` documents each one). You'll need:

| Service                  | Vars                                                    |
| ------------------------ | ------------------------------------------------------- |
| Supabase Postgres        | `DATABASE_URL`                                          |
| NextAuth                 | `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `NEXTAUTH_URL` |
| Google OAuth             | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`              |
| Google Gemini            | `GOOGLE_GENERATIVE_AI_API_KEY`                          |
| Uploadthing              | `UPLOADTHING_TOKEN`                                     |
| Pinecone                 | `PINECONE_API_KEY`, `PINECONE_ENVIRONMENT`              |
| Hugging Face             | `HUGGINGFACE_API_KEY`                                   |
| Supabase client (scripts)| `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`           |
| Liveblocks               | `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_API_KEY`                 |

Set up the services:

- **Supabase** — create a project, copy the connection string, then `pnpm --filter @uxie/web exec prisma db push`.
- **Pinecone** — create an index with **768 dimensions** and the **cosine** metric
  (matching `BAAI/bge-base-en-v1.5`; see `shared/lib/embedding-models.ts`).
- **Google OAuth** — authorised redirect URI is `$NEXTAUTH_URL/api/auth/callback/google`.

Then:

```bash
pnpm dev:web    # http://localhost:3000
```

Google sign-in requires real OAuth credentials. To poke at the reader without any backend,
open [`/demo`](http://localhost:3000/demo) — it's fully client-side.

## Scripts

Run via `pnpm --filter @uxie/web <script>`:

| Script            | What it does                                  |
| ----------------- | --------------------------------------------- |
| `dev` / `build` / `start` | Standard Next commands                |
| `typecheck`       | `tsc --noEmit` — use this, not a full build    |
| `lint`            | `next lint`                                   |
| `test`            | Vitest                                        |
| `scripts:db-dump` | Dump the DB to the Supabase `database-backups` bucket |

## Things worth knowing

- **Plan limits** live in `src/lib/constants.ts` (`PLANS`). Document count, page count and
  file size all derive from there — the uploadthing route allows the most generous plan's
  size and the middleware enforces the user's actual plan, since that's the only place the
  plan is known. Don't hardcode a size anywhere else.
- **`MOCK_AI=1`** stubs the `/api/completion` response so you can iterate on the notes
  editor without burning Gemini quota. It's off by default, so autocomplete works normally
  in dev.
- **Collaboration is currently disabled** (`src/components/editor/collaboration-client.tsx`
  is commented out) after hitting Liveblocks free-tier limits. Note the Liveblocks client
  runs on a public key with no auth endpoint (`liveblocks.config.ts`) — any client could
  join any room, so wire up `authEndpoint` before re-enabling.
- **The demo page** (`src/components/demo`, `src/lib/demo`) has no backend. When you add a
  reader feature, wire it into the demo too if it doesn't need server/AI/DB/auth.
- `next.config.mjs` has webpack workarounds for `scribe.js-ocr` and `kokoro-js` that are
  marked DO NOT REMOVE — both break without them.

## Roadmap / known issues

- [ ] Add proper prompts for each item in `custom/ai/popover.tsx`
- [ ] Category/tags system for documents
- [ ] Rate limiting (especially AI routes) — Upstash Redis
- [ ] Better error and loading pages
- [ ] `.tippy-arrow` still appears when hovering the PDF reader (temp fix in place)
- [ ] Background runner with long-polling for vectorisation / flashcard generation
- [ ] Store area-highlights in Uploadthing rather than base64 in notes
- [ ] Send page number when tool-calling, and link it back to the page
- [ ] Semantic search, improved RAG with cited sources, PDF summaries

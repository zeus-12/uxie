# Uxie — notes for agents

Next.js (Pages Router) T3 app (tRPC, Prisma/Postgres, NextAuth, Pinecone, Gemini).
Core surface: the PDF reader (highlights, notes, chat, flashcards). A desktop app
is in progress on a separate branch.

## Workflow

- Align before changing: check the code, explain the fix, wait for my OK — unless it's trivial.
- Never commit or push without my explicit approval — every time, even mid-batch.
- No PRs or new branches unless I ask. Default to `main`.

## Where code goes

- Logic useful to both web and desktop → the **shared** folder, abstracted for both. Don't duplicate per app.
- Reader features → decide if they also belong in the local `/demo` (see below).

## `/demo`

Unauthenticated, fully local mirror of the reader — data lives in the browser
(`useDemoDocStore`), **zero** backend calls, reusing production components via DI
seams (`src/components/demo/`, `src/lib/demo/`). When changing a reader feature,
deliberately either wire it into the demo (keep it identical) or keep it out
(anything touching servers/AI/DB, auth, or collab).

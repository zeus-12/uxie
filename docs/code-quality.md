# Code quality backlog

Deferred findings from an audit of the monorepo after the web + desktop merge. **None of
these break the app today** — the boot-blocking and user-facing bugs were already fixed.
What's left is duplication, scattered constants and drift between `apps/web/src` and
`shared/`, which is a correctness risk over time rather than right now.

Each item is tagged **[WEB]**, **[DESKTOP]** or **[SHARED]**.

Suggested order: constants first (2, 3, 5), then prompts/schemas (4), then the file-by-file
reconciliation (7, 8) — the merges have fewer moving parts once the constants are central.

---

## 1. Duplicated zustand stores writing the same localStorage key — [WEB] + [SHARED]

`shared/lib/store.ts:60-93` and `apps/web/src/lib/store.ts` both create
`usePdfSettingsStore` with `persist(..., { name: "pdf-settings" })`.

Web imports `@uxie/shared/lib/store` in 6 files and `@/lib/store` in 18. It doesn't break
visibly today because only chat and sidebar-tab state come from shared. But
`shared/components/pdf-reader/toolbar/panel-toggle.tsx:2`,
`shared/components/pdf-reader/toolbar/settings-controls.tsx:9` and
`shared/components/pdf-reader/rsvp-reader.tsx:16` all read the *shared* store — the moment
web adopts any of those, there are two React store instances writing one localStorage key.
Symptoms: toggles that don't propagate, last-writer-wins corruption.

**Fix:** delete the duplicated stores from `apps/web/src/lib/store.ts` and re-export from
`@uxie/shared/lib/store`. The file's own comment at lines 29-30 already says this was the
plan.

## 2. AI model IDs scattered across 6 files, no registry — [WEB] + [SHARED]

- `gemini-2.5-flash` — `app/api/chat/route.ts:96`, `app/api/completion/route.ts:18`,
  `lib/summarize.ts:37,51,106`, `lib/flashcard.ts:40`, `app/api/evaluate/route.ts:58`
- `BAAI/bge-base-en-v1.5` — `lib/vectorise.ts:32` and `:43` (twice in one class; should
  come from `shared/lib/embedding-models.ts`, which now exists)
- `onnx-community/Kokoro-82M-v1.0-ONNX` — `lib/tts/providers/kokoro-provider.ts:55` **and**
  `shared/lib/tts/providers/kokoro-provider.ts:54`
- `onnx-community/Supertonic-TTS-2-ONNX` — `lib/tts/providers/supertonic-provider.ts:29,31`
  **and** `shared/…:28,30`

**Fix:** a `shared/lib/models.ts` exporting `CHAT_MODEL`, `COMPLETION_MODEL`, `EVAL_MODEL`,
`SUMMARY_MODEL`, `FLASHCARD_MODEL`, `KOKORO_MODEL_ID`, `SUPERTONIC_MODEL_ID`, each
overridable by env so a model can be A/B'd without a deploy.

## 2b. BGE retrieval queries are missing the required prefix — [WEB] + [DESKTOP]

Both apps now embed with `bge-base-en-v1.5`. That model's card specifies that retrieval
**queries** (not documents) should be prefixed with
`"Represent this sentence for searching relevant passages: "`. Neither app does it:
`apps/web/src/lib/vectorise.ts` `embedQuery` embeds raw, and desktop's
`shared/lib/embeddings.ts` `embedText` is used for both sides of the comparison.

Retrieval still works — it's consistent, just not what the model was trained for — but
adding the prefix is a documented, measurable quality win. Needs a separate
`embedQuery` / `embedDocument` split so the prefix is only applied to queries, and
existing vectors don't need re-embedding (only the query side changes).

## 3. Chunking constants duplicated 4×, across two packages — [WEB] + [SHARED]

`chunkSize: 1000, chunkOverlap: 200` appears in `apps/web/src/lib/vectorise.ts:86-89`,
`apps/web/src/lib/flashcard.ts:27-30`, `shared/lib/embeddings.ts:49-52`,
`shared/lib/flashcards.ts:27-30`. Both shared files carry comments *asserting* they match
web — an assertion nothing enforces. The `> 20` min-chunk filter
(`embeddings.ts:54`, `flashcards.ts:34`) doesn't exist in web's versions at all, and
`similaritySearch(question, 4)` (`vectorise.ts:141`) is another loose top-K.

**Fix:** `shared/lib/chunking.ts` with `CHUNK_SIZE`, `CHUNK_OVERLAP`, `MIN_CHUNK_CHARS`,
`RETRIEVAL_TOP_K`.

## 4. Prompts and schemas duplicated, several already drifted — [WEB] + [SHARED]

- **Completion prompt** — `shared/lib/ai-prompts.ts:3-8` claims to be the same instruction
  `/api/completion` uses. It isn't; the route had extra sentences. *(The truncated
  `"only reply with the "` fragment that was being shipped to the model has been fixed, but
  the two copies still exist.)* Route should import `COMPLETION_INSTRUCTION`.
- **Flashcard generation prompt** — `apps/web/src/lib/flashcard.ts:7-8` vs
  `shared/lib/flashcards.ts:6-7`. Byte-identical now; guaranteed to drift.
- **Flashcard feedback prompt** — `app/api/evaluate/route.ts:45-55` builds its own,
  containing the typo **`ghen`** ("…made by the user, ghen provide additional…").
  `shared/lib/flashcards.ts:54-65` has a clean `buildFlashcardFeedbackPrompt`.
- **`flashcardFeedbackSchema` / `flashcardSchema` defined three times** —
  `shared/schema/flashcard.ts:3-12`, `apps/web/src/schema/flashcard.ts` (identical
  duplicate), and again *without* `.describe()` in `shared/lib/flashcards.ts:9-22`. The
  `.describe()` calls are model-facing field docs fed to `streamObject`
  (`evaluate/route.ts:59`), so the third copy produces measurably different output.

## 5. LLM tuning constants inline — [WEB] + [DESKTOP]

**Web:** `app/api/chat/route.ts:102` `maxOutputTokens: 2000`, `:101` `stepCountIs(3)`,
`:39` `maxDuration = 30`; `app/api/completion/route.ts:36-39` `temperature/topP/penalties`;
`lib/summarize.ts:7-8,39,53,85,98,100,112` (chunk size, overlap, concurrency, batch sizes).

**Desktop:** `main/ai/flashcards.ts:38` `CONCURRENCY = 3`; `main/ai/completion.ts:38`
`temperature: 0.7` (set *only* here — chat and flashcards get provider defaults, which is
inconsistent and invisible); `main/ai/chat.ts:91` `stopWhen: stepCountIs(3)`;
`main/ai/chat.ts:45-48` a `20_000`ms retrieval timeout that may be too short on a cold
transformers.js worker during first model download — the model silently receives `[]`
instead of an error; `renderer/rag.ts` top-K default `k = 4`.

Also **duplicated verbatim** including its comment: `smoothStream({ delayInMs: 12,
chunking: "word" })` in `main/ai/chat.ts:95` and `main/ai/completion.ts:41`.

**Fix:** `src/main/config.ts` (desktop) and an equivalent for web, exporting frozen `RAG` /
`LLM` objects. Extract `STREAM_TRANSFORM` once.

## 6. `PDF_SCHEME` declared twice across the process boundary — [DESKTOP]

`main/pdf.ts:24` `export const PDF_SCHEME = "uxie-pdf"` (serves it) and
`renderer/pdf-cover.ts:13` `const PDF_SCHEME = "uxie-pdf"` (requests it, line 20). The URL
shape `${scheme}://doc/${id}` is also re-derived in both. Two processes agreeing on a magic
string by coincidence rather than by import; rename one and cover generation silently 404s
with no compile error.

Same pattern, lower stakes: the table name `doc_vectors` appears as a raw SQL string 5× in
`main/db/vectors.ts` — the one table with no single definition point, since the rest is
Drizzle-managed. And the on-disk layout (`uxie.db`, `documents/`, `covers/`,
`settings.json`, `drizzle/`) is spread across four files plus `electron-builder.yml`, which
a "change library location" feature would have to touch all of.

**Fix:** move the scheme and both URL builders into `src/ipc-contract.ts` (already the
shared, Node-free, both-processes module).

## 7. `shared/` mirrors ~55 files web also has, and they've diverged — [WEB] + [SHARED]

Web only imports 10 of them. The mirrors are **not** in sync. Where the shared copy is
meaningfully behind:

- **`shared/lib/tts/utils.ts` vs `apps/web/src/lib/tts/utils.ts`** (118-line diff) — web has
  `normalizeWhitespace()` + offset map, `LINE_BREAK_HYPHEN_*` regexes, and symbol-only-token
  matching (`:115-134`). Shared has none of it (`shared/…:45` just `continue`s on symbol
  tokens). **Desktop's TTS highlighting is measurably worse than web's for the same text.**
- **`shared/hooks/use-sentence-reader.ts` (882 lines) vs web's (817)** — different
  *architectures*, not drift: shared wraps DOM text nodes
  (`HIGHLIGHT_CLASS`/`HIGHLIGHT_TAG`, `:11-25`), web uses an absolutely-positioned overlay
  (`OVERLAY_LAYER_CLASS = "tts-hl-layer"`, `:22-24`). Two implementations of the most
  complex hook in the codebase.
- **`shared/lib/tts/providers/kokoro-provider.ts:111-121`** and
  **`supertonic-provider.ts:120-130`** — missing the `findVoicedRangeMs()` silence-trimming
  web has, so desktop word highlights drift against padding silence.
- **`shared/lib/utils.ts:8-15`** — has only `copyTextToClipboard` + `stripTextFromEnd`;
  web's (`apps/web/src/lib/utils.ts:10-113`) also has `feedbackFormSchema`, `FEEDBACK_TYPES`,
  `isDev`, `isBrowser`, `waitFor`, `log`, `downloadPageAsHtml`, `generateDummyStream`.
  **Same name, different signature:** `copyTextToClipboard(text)` (shared) vs
  `copyTextToClipboard(text, callback)` (web) — silent breakage if ever crossed.
- **`shared/lib/constants.ts:1-8` vs `apps/web/src/lib/constants.ts`** —
  `PDF_BACKGROUND_COLOURS` duplicated verbatim, including the `// dont change this order`
  comment that both `store.ts` copies depend on for their default.
- **`shared/components/editor/index.tsx` (235 lines) vs web's (386)**,
  **`flashcard/index.tsx` 79 vs 100**, **`workspace/sidebar.tsx` 103 vs 87**,
  **`pdf-reader/highlight-popover.tsx`** (172-line diff) — all substantially divergent.

**Fix:** pick a direction per file. The ~40 `components/ui/*` files differ only in import
style (`../../lib/utils` vs `@/lib/utils`, ~4-line diffs) and are safe to collapse
immediately. The TTS / editor / reader ones need a real merge.

## 8. Platform leakage in `shared/` — [SHARED]

No `next/router`, `next/link`, `next-auth` or `process.env` anywhere — good. The leaks are
subtler:

- **`shared/hooks/use-pdf-reader.tsx` is the older API.** Shared takes
  `onSaveLastReadPage?: (page) => void` (`:28,33`); web's takes
  `onUpdateLastReadPage?: (docId, pageNumber) => void` and **hard-wires tRPC**
  (`apps/web/src/hooks/use-pdf-reader.tsx:105`, called at `:113`). Web's is unusable from
  desktop; shared's is the correct shape. They disagree on callback arity, so they aren't
  drop-in swappable.
- **`shared/types/pdfjs.d.ts:9`** does `window.PdfViewer = window.PdfViewer || {}` at module
  scope — a global mutation from a `.d.ts`.
- **`shared/components/editor/custom/highlight.tsx:30`** sets `document.location.hash` for
  highlight-jump. No-op in an Electron `file://` renderer; assumes web's router.
- Browser globals at module scope (`lib/tts/index.ts:35-36` `navigator.gpu`,
  `lib/utils.ts:9` `navigator.clipboard`, `hooks/use-browser-tts.ts:29`
  `window.speechSynthesis`) will throw under Next SSR. Web only sidesteps this today by
  using its own copies.

## 9. Hardcoded URLs and site config — [WEB]

- **`next-seo.config.ts:7`** — `url: "UXIE"`, a literal placeholder shipping as the
  OpenGraph URL, with the real value commented out on line 8. Line 13 bakes in
  `https://uxie.vercel.app/og.png`. Should derive from `NEXT_PUBLIC_SITE_URL` /`VERCEL_URL`.
- **`src/components/other/features.tsx:12,20,28,34,41`** — five CDN URLs containing the
  account-specific Uploadthing app id `g228eq4f8z`. Break on account rotation and can't be
  self-hosted; these are marketing images that belong in `/public`.
- **`next.config.mjs:12`** — `images.domains: ["lh3.googleusercontent.com", "utfs.io"]`.
  The assets above are served from `*.ufs.sh`, not `utfs.io` — allowlist and usage have
  already diverged (they escape it by being plain `<img>`). Also `domains` is deprecated in
  Next 14 in favour of `remotePatterns`.
- **`src/hooks/use-speak-along.ts:82`** — `https://api.dictionaryapi.dev/...` hardcoded on
  the hot path, unauthenticated, no timeout, no fallback, locale fixed to `en`.
- **`src/scripts/db-dump.ts:40`** — bucket `"database-backups"` hardcoded.
- **Route literals** — `/f` and `/login` appear in `src/middleware.ts:14,22,35,51-52` and
  `src/server/auth.ts:51` with no shared constant. (The `matcher` must stay literal — Next
  requires statically analysable values — but the redirects shouldn't.)
- **`src/pages/index.tsx:64`** — personal blog URL in the landing hero.
- **Client API paths** hardcoded per call site: `components/chat/index.tsx:85` `/api/chat`,
  `components/flashcard/index.tsx:34` `/api/evaluate`,
  `components/editor/custom/ai/popover.tsx:159` `/api/completion`. **This is the exact seam
  that blocks sharing these components with desktop** — a shared chat panel can't hit a
  Next.js route path. Needs an injected `apiBase`/transport.

## 10. Dead and commented-out config — [WEB]

- **`liveblocks.config.ts:7-8`** — `authEndpoint` and `throttle` commented out, so
  Liveblocks runs on a **public key with no auth endpoint**: any client can join any room.
  Must be wired up before collaboration is re-enabled.
- **`src/components/editor/collaboration-client.tsx:6-30`** — the entire `RoomProvider` is
  commented out.
- **Two different dev predicates** — `src/lib/utils.ts:76` defines `isDev` off
  `NEXT_PUBLIC_ENV`, while other code branches on `NODE_ENV`.

## 11. Window state and misc — [DESKTOP]

- **No window-state persistence** (`main/index.ts:118-125`) — size and position reset to
  1400×900 every launch, even though `settings.json` already exists as a mechanism.
- **`backgroundColor: "#ffffff"` hardcoded** while the renderer ships a Tailwind theme with
  CSS variables — a guaranteed white flash if dark mode is ever added.
- **Dev `console.log`s ship in packaged builds** — `main/db/index.ts:26`,
  `renderer/library.tsx:57,60`, `renderer/flashcards.tsx:79,84`. (`library.tsx:65` and
  `flashcards.tsx:87` are legitimate error logs.)
- **`electron-rebuild -f -w better-sqlite3` is repeated in four `package.json` scripts**,
  and `pretest` uses a *different* command (`pnpm rebuild`) — so tests and dev can run
  against differently-built native binaries. This is a real footgun: running the test suite
  leaves the tree unable to start Electron until you rebuild again.
- **No CSP meta tag** (`renderer/index.html:3-7`) and `contextIsolation`/`nodeIntegration`
  rely on Electron 35 defaults rather than being stated (`main/index.ts:126-128`). Safe
  today, fragile across majors. `main/pdf.ts:44` sets
  `access-control-allow-origin: "*"` on the custom protocol, broader than needed.
- **Dev vs packaged `userData` differ** — dev writes to
  `Application Support/@uxie/desktop/` (derived from the package name) while packaged
  builds use `Application Support/Uxie/`. Worth setting `app.setName()` so they match.

---

# Second pass (2026-07-25) — web↔desktop behaviour parity

The items above are hygiene. These are places where the *same feature* behaves worse on
desktop because the shared copy is the older one. Re-verified against the current tree.

**Status: 12–18 are DONE (2026-07-25), and doing them resolved most of 1, 7 and 8 as a
side effect.** What moved into `shared/`, web's copy deleted and re-pointed in each case:

- **All 27 `components/ui/*`** — web's version won wherever the two differed
  (`dialog.tsx` slide animations, and `sonner.tsx` merged so it keeps the `toast`
  re-export desktop imports).
- **The whole TTS stack** — `lib/tts/**` (utils, base-audio-provider, both local
  providers), `hooks/use-sentence-reader` (overlay architecture), `use-browser-tts`,
  `use-local-tts`, `use-rsvp-reader`, plus the `.tts-hl-*` CSS into
  `shared/globals.css` (the stale `.current-sentence` / `.rsvp-word` rules are gone).
  Desktop now gets normalisation, hyphen joining, silence trimming and latency
  compensation. Verified by `apps/web/src/__tests__/tts-highlight.test.ts`, which moved
  with it and passes against the shared module.
- **`hooks/use-pdf-reader`** — shared's callback-injected shape won; web's tRPC
  `updateLastReadPage` moved up into `components/pdf-reader/reader.tsx`.
- **`components/pdf-reader/pdf-highlighter.tsx`** — new shared component built from web's,
  with persistence injected (`addHighlight` / `deleteHighlight` / `updateAreaHighlight`).
  It carries the jump effect, the selection tracker and the links listener, so desktop's
  ~180-line inline re-implementation in `renderer/reader.tsx` is gone. Web's optimistic
  area-highlight mutation moved into its reader.
- **`highlight-popover`** — web's richer version (selection info, sidebar tab switch) is
  now the shared one.
- **Stores** — `apps/web/src/lib/store.ts` is a re-export shim over
  `@uxie/shared/lib/store`. The two `persist(…, "pdf-settings")` instances are one.
  Same treatment for `lib/constants`, `lib/utils` (`cn`, `copyTextToClipboard`,
  `stripTextFromEnd`) and `components/pdf-reader/constants` (which was two copies of the
  same enum — two distinct types).
- **Toolbar + friends** — the six leaf toolbar controls, `rsvp-reader`, `floating-panel`,
  `feature-card`, `schema/flashcard`: import-only copies, deleted from web.

`shared/package.json` gained `react-pdf-highlighter`, and web's `vitest.config.ts` gained a
`@uxie/shared` alias.

**Still duplicated** (real drift, each needs a decision rather than a move):
`components/editor/index.tsx` (386 vs 235), `components/workspace/sidebar.tsx` (87 vs 103),
`workspace/doc-card.tsx`, `lib/editor-utils.ts`, `types/editor.ts` (web adds Yjs types),
`editor/custom/{alert,highlight}.tsx`, and `pdf-reader/toolbar/index.tsx` — the last one
only because web's renders `SpeakAlong` and a mobile `SidebarDrawer` (see 17); the fix is
an injected-slot prop, not a copy.

## 12. The "disable links" toggle does nothing on desktop — [DESKTOP]

`shared/components/pdf-reader/toolbar/settings-controls.tsx:61,94` renders the toggle and
`shared/lib/store.ts:34,63-66` holds the state, but the code that actually suppresses
annotation-link clicks lives **only** in web:
`apps/web/src/components/pdf-reader/pdf-highlighter.tsx:184-203`. Desktop renders the
shared toolbar, so the switch flips and persists and has no effect.

**Fix:** move that listener into `shared/hooks/use-pdf-reader.tsx` (it already owns the
viewer) so both apps get it from one place, and drop web's copy.

## 13. Web's `PdfHighlighter` wrapper is re-implemented inline on desktop — [DESKTOP]

`apps/web/src/components/pdf-reader/pdf-highlighter.tsx` (350 lines) and
`apps/desktop/src/renderer/reader.tsx:407-486` build the same `react-pdf-highlighter` tree
with the same `highlightTransform` / `Popup` / `AreaHighlight` wiring. The
`jumpToHighlight` effect is a **verbatim copy, comment-for-comment** —
web `:97-131` vs desktop `:220-254`.

Only three things genuinely differ: persistence (tRPC + optimistic cache vs `window.uxieAPI`
+ local state), `HighlightTypeEnum` vs a string literal, and web's `<div id={highlight.id}>`
wrappers. All three are injectable.

**Fix:** `shared/components/pdf-reader/pdf-highlighter.tsx` taking
`highlights`, `onAddHighlight`, `onDeleteHighlight`, `onUpdateAreaHighlight`; both apps pass
their own persistence. The jump effect belongs in a `useHighlightJump(highlights, viewer)`
hook in shared regardless.

## 14. Read-from-selection is coarser on desktop — [DESKTOP]

Web tracks where in the text layer a selection started (`selectionInfoRef` —
`pdf-highlighter.tsx:64-69`, populated by the `mouseup` handler at `:135-176`) and passes
`selectionBlockIndex` / `selectionOffsetInBlock` / `selectionPageNumber` into
`readSelectedText`. `shared/components/pdf-reader/highlight-popover.tsx:14-18` has none of
those params, so on desktop "Read the text" gets only the string.

**Fix:** this belongs with 13 — the mouseup tracker goes into the shared wrapper, and the
shared popover takes web's wider `readSelectedText` signature.

## 15. Audio→highlight sync fixes are web-only — [DESKTOP]

Extends item 7 (which covers `tts/utils.ts` and `findVoicedRangeMs`). Also missing from
shared: `apps/web/src/lib/tts/base-audio-provider.ts:235-246` subtracts
`audioContext.outputLatency || baseLatency` from the highlight clock. Without it the
highlight runs ahead of the audio and short first words never show — desktop has this bug.

## 16. `ui/dialog.tsx` is not an import-only diff — [SHARED]

Item 7 says the ~40 `components/ui/*` mirrors differ only in import style. One exception:
`shared/components/ui/dialog.tsx:41` uses `duration-150` and drops the four
`slide-in/slide-out` classes web has at the same line. So every desktop dialog animates
differently from web's. Decide which is intended before collapsing the pair — don't assume
these files are interchangeable.

## 17. Reader parity gaps that are *correct* divergences — [DESKTOP]

Listed so they aren't "fixed" by mistake: no `SpeakAlong` in the shared toolbar
(web-only, `apps/web/src/components/pdf-reader/toolbar/index.tsx:179`); no
`SidebarDrawer` / `isSmallScreen` branch (`:132-153`) — desktop has no mobile viewport.
`SpeakAlong` is worth porting eventually, the drawer is not.

## 18. Loading states — [DESKTOP] — fixed 2026-07-25

Desktop showed plain text where web shows a spinner: `reader.tsx` `beforeLoad` ("Loading
PDF…") and the document fetch ("Loading…"), plus the settings dialog. All three now use
`Spinner`/`SpinnerPage` from `@uxie/shared/components/ui/spinner`, matching
`apps/web/src/components/pdf-reader/reader.tsx:75` and
`apps/web/src/components/workspace/index.tsx:117`. Kept here as the example of the class:
**shared components + app-local chrome means polish added on one side never reaches the
other.**

---

## Explicitly fine — don't "fix" these

`LOCAL_USER_ID = "local-user"` (single-user by design, correctly centralised and reused);
the IPC channel maps in `ipc-contract.ts` (the best-factored part of the desktop codebase);
the SQLite pragmas in `db/client.ts:19-21`; `appId`/`productName`/`category` and the DMG
icon coordinates; `process.platform === "darwin"` checks (idiomatic, not an assumption);
`asarUnpack` for sqlite-vec and `npmRebuild: false` (both load-bearing); the desktop test
fixtures (correctly use `tmpdir()` and `:memory:`); and the `scribe.js-ocr` / `kokoro-js`
webpack workarounds in `next.config.mjs`.

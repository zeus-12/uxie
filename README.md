# [Uxie](https://uxie.vercel.app)

[![thumbnail](./public/thumbnail.png)](https://www.youtube.com/watch?v=m97zcPWSceU)

PDF reader app designed to revolutionise your learning experience!

🚀 Developed with features like:

- 📝 Annotation, note-taking, and collaboration tools
- 📚 Integrates with LLM for enhanced learning
- 💡 Generates flashcards with LLM feedback

Originally started as a hackathon project which I ended up winning 🥇!

Uxie has since evolved with even more exciting features.

I'd love for you to give Uxie a try and share your valuable [feedback](https://uxie.vercel.app/feedback).

### Built using

- **Nextjs** Frontend and Serverless api routes
- **tRPC** For typesafe apis
- **Zod** For validation
- **Typescript** For type safety
- **Tailwind CSS** For CSS
- **React Query** for data fetching, optimistic updates
- **React Hook Form** for form handling
- **Shadcn UI + Radix UI** For UI components
- **Supabase** As the database
- **Prisma** As the ORM
- **Blocknote** for note taking
- **Uploadthing** for storing pdfs
- **Next Auth** for authentication
- **React-pdf-highlighter** for pdf rendering,highlighting
- **Vercel AI SDK, Langchain** for AI responses and streaming, generating flashcards + evaluating them
- **Pinecone DB** for storing embeddings of pdfs
- **Fireworks AI** for LLM
- **Huggingface Model** for generating Embeddings
- **Liveblocks** for realtime collaboration
- **Nuqs** for type-safe search params

## Features:

- Note taking, later download the note as markdown
- Summarise, ask questions about the PDFs
- Chat and collab with other (collaboration disabled for now-hit free tier limits :'(
- Custom blocks in editor
- Highlights block which on click takes you to that highlight on the doc.
- AI-powered text autocompletion, and text enhancement
- PDF text-to-speech (English only) with sentence-by-sentence highlighting. (spent insane amt of hours on this, and super happy with how it turned out.)
- PDF OCR support (English only)
- Craft simple flashcards to test your knowledge, answer questions, and receive instant feedback through AI evaluation.

### Bugs

- [ ] addHighlightToNote doesn't work on small screens w sidebar.
- [ ] add proper prompts for each item in custom/ai/popover.tsx
- [ ] display a x% done in /f.
- [ ] build a category system for documents => doesn't matter if ui is bad, just build it
- [ ] implement ratelimit (esp for everything ai related) using redis kv => checkout upstash
- [ ] add download flashcards in csv,anki format ( apkg format), also add dl notes in pdf format ([html2pdf lib](https://ekoopmans.github.io/html2pdf.js/) should work)
- [ ] better error,loading pages => abstract this logic to hook / component
- [ ] editor loads with empty data before the data is loaded.
<!-- - [ ] (NOT USING LIVEBLOCKS ANYMORE) see if u can see all the users (also typing status for chat: [refer](https://github.com/konradhy/build-jotion/blob/master/components/editor.tsx#L93)) in the liveblocks room, (and display it at top) -->
- [ ] fix `.tippy-arrow` appearing on screen at all times => added a temp fix. still appears when hovered over the pdf reader
- [ ] abstract userIsOwner and userHasAccess (either collab or owner) logic.
      solution seems to be => create separate helper functions (take where, select, etc as params: use relevant prisma types to match each.)
- [ ] some way to hide the bottom-toolbar (separate settings page or just drag to side?)
- [ ] TTS: experiment with the voice (changing pitch, etc), or maybe try on-device models (Kokoro TTS)

## New ideas

- [ ] use background runner with long-polling for vectorisation / flashcard gen
- [ ] For area-highlight
      -store it as base64 to the notes, then in the same addHighlightToNote function upload it to uploadthing, and then update the url of the block in the notes. => would prob need to create a custom block for this, else there'd be a noticable lag.
      -add the yellow leftborder which takes to the image highlight on click
- [ ] see if the liveblocks stuff can be replaced w. sockets [refer](https://www.blocknotejs.org/docs/real-time-collaboration#yjs-providers)
- [ ] Run the seogets script, maybe try automated reels? (reel.farm)
- [ ] send page number whenever tool-calling is used, then display it under the text. (which takes to that page on click)
- [ ] add bm25 along w vector embeddings? https://www.anthropic.com/news/contextual-retrieval#:~:text=BM25%20can%20succeed%20where%20semantic%20embeddings%20fail
- [ ] store the content of text-highlight and make it available for search (from a cmd+k window, along w separate tab, and maybe also from /f) => prob not useful for image-highlights (or maybe run ocr on image highlights (using tesseract, (scribe is overkill here)) and store that) => prob not useful, since everything gets added to notes already, then searching that is a simple cmd+f

## Setting up guide

### Install dependencies

```
pnpm i
```

### Set up environment variables

copy the `.env.example` file to `.env` and fill in the required values.

### Start the development server

```
pnpm dev
```

### Pinecone

- Create index
- Dimensions = 768
- Metric = Cosine

## Deployed at [https://uxie.vercel.app](https://uxie.vercel.app)

### Built using

- **Nextjs** App dir For the frontend and serverless api routes
- **tRPC** For typesafe api routes
- **zod** For validation
- **Typescript** For type safety
- **Tailwind CSS** For styling
- **React Query** for data fetching
- **React Hook Form** for form handling
- **Shadcn UI + Radix UI** For UI components
- **Supabase** As the database
- **Prisma** As the ORM
- **Blocknote** for note taking
- **Uploadthing** for storing pdfs
- **Next Auth** for authentication
- **React-pdf-highlighter** for pdf rendering,highlighting
- **Vercel AI SDK, Langchain** for AI responses and streaming
- **Pinecone DB** for storing embeddings of pdfs
- **Fireworks AI** for LLM
- **Huggingface Model** for generating Embeddings

### Features:

- **Website**:
  - Note taking
  - Summarise PDFs
  - Chat and collab with other
  - Export highlights of your pdf

## TODOS

- [x] copying text from pdf ignores linebreaks
- [x] add images to some free provider or cloudinary: use cloudinary for storage => also provides the getFirstPage of pdf thing. (see whether i should save this or call this every time => on how much resource it takes)
- [x] fix linking to the highlighted part for highlighted text on notes.
- [x] also other note taking apps (obsidian,etc) : add a download as markdown feature for starters
- [x] add dark mode for the bg of home screen
- [x] save chat messages to db after streaming (some handler onComplete fn
- [x] give solid width for the yellow line in the highlighter cusotm block in notes
- [x] create a isVectorised (use better name) column in document, and check that on the chat screen
- [x] highlight popover tip not appearing at times (for later pages)
- [ ] integrate ai =>
  - [x] custom llm
  - [ ] chrome extension: prob wont happen => no good reason, since we cant feed the vectorised data to it.
- [ ] optimistic update for file page after adding a new file
- [ ] integrate yjs or whatever for realtime note editing for blocknotes (eg already existing)
- [ ] fix seo stuff, use next-seo
- [ ] have a hardcoded message as first message of every chat => something like => "Hey there, ask me anything about this document!"

## Features to pitch

- custom blocks in editor
- highlights block which on click takes you to that highlight on the doc.
- download as markdown

## Setting up guide

### Pinecone

- Create index => Dimensions = 768, Metric = Cosine

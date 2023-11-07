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

- [x] add images to some free provider or cloudinary: use cloudinary for storage => also provides the getFirstPage of pdf thing. (see whether i should save this or call this every time => on how much resource it takes)
- [ ] optimistic update for file page after adding a new file
- [ ] integrate yjs or whatever for realtime note editing for blocknotes (eg already existing)
- [ ] fix seo stuff, use next-seo
- [ ] store highlights as plain json. it was super dumb to store it as separate tables.
- [ ] have a "summarise" text option right next to highlight text on selecting the text.

## Features to pitch

- custom blocks in editor
- highlights block which on click takes you to that highlight on the doc.
- download as markdown

## Setting up guide

### Pinecone

- Create index => Dimensions = 768, Metric = Cosine

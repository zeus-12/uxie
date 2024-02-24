# [Uxie](https://uxie.vercel.app)

[![thumbnail](./public/thumbnail.png)](https://www.youtube.com/watch?v=m97zcPWSceU)

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
- **Vercel AI SDK, Langchain** for AI responses and streaming, generating flashcards + evaluating them
- **Pinecone DB** for storing embeddings of pdfs
- **Fireworks AI** for LLM
- **Huggingface Model** for generating Embeddings
- **Liveblocks** for realtime collaboration

## Features:

- Note taking, later download the note as markdown
- Summarise, ask questions about the PDFs
- Chat and collab with other
- custom blocks in editor
- highlights block which on click takes you to that highlight on the doc.
- AI-powered text autocompletion
- Craft simple flashcards to test your knowledge, answer questions, and receive instant feedback through AI evaluation.

## REGRETS

- [ ] 10s limit on serverless function SUCKS! Should've chosen drizzle/kysely over prisma (for edge functions) UGHGHH
      checkout [acme-corp project](https://github.com/juliusmarminge/acme-corp) => using both prisma and kysely
- [ ] prob better to use a background runner or something and do long-polling

### Low priority

- [ ] implement ratelimit using redis kv => checkout upstash
- [ ] profile how long pinecone takes for retrieval of embeddings, and maybe look into upstash embedding storage for this (or pgvector?)
- [ ] add a message similar to the one on flashcards tab for chat tab.
- [ ] add download flashcards in csv,anki format.
- [ ] better error,loading pages => abstract this logic to hook / component
- [ ] editor loads with empty data before the data is loaded.
- [ ] setup permissions inside liveblocks dashboard
- [ ] see if u can see all the users (also typing status for chat: [refer](https://github.com/konradhy/build-jotion/blob/master/components/editor.tsx#L93)) in the liveblocks room, (and display it at top)
- [ ] fix `.tippy-arrow` appearing on screen at all times => added a temp fix. still appears when hovered over the pdf reader
- [ ] areahighlight from pdf => imagelink stored on editor is base64 one => possible soln: store it as base64 to the notes, then in the same addhighlighttonotes function upload it to uploadthing, and then update the url of the block in the notes. => would prob need to create a custom block for this, else there'd be a noticable lag. => [issue fixed!](https://github.com/TypeCellOS/BlockNote/issues/410)
- [ ] abstract userIsOwner and userHasAccess (either collab or owner) logic.
      progress:
      => api called `experimental_standaloneMiddleware` but

      1. it requries the types for the entire input, the only way seems to be putting any for the rest => losing typesafety for the whole route
      2. most times data is returned from this, so query will also run twice

  solution seems to be => create separate helper functions (take where, select, etc as params: use relevant prisma types to match each.)

- [ ] fix the size of the highlight popover on small screens

## New ideas

- [ ] see if the liveblocks stuff can be replaced w. sockets [refer](https://www.blocknotejs.org/docs/real-time-collaboration#yjs-providers)
- [ ] maybe swap uploadthing with `cloudinary` => also provides the getFirstPage of pdf thing. (see whether i should save this or call this every time => on how much resource it takes)
- [ ] have a "summarise", "explain" option right next to highlight text on selecting the text.

### Pinecone Setting up guide

- Create index => Dimensions = 768, Metric = Cosine

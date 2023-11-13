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
- **Liveblocks** for realtime collaboration

### Features:

- **Website**:
  - Note taking
  - Summarise PDFs
  - Chat and collab with other
  - Export highlights of your pdf

## TODOS

- [ ] add logs in uploadthing route to see why vectorising fails at times.

## BUGS

- [ ] optimistic update for file page after adding a new file => uploadthing issue, should be fixed on v6
- [ ] see if u can see all the users in the liveblocks room, (and display it at top)
- [ ] get light coloured background for `liveblocks presence` => https://stackoverflow.com/questions/23601792/get-only-light-colors-randomly-using-javascript
- [ ] reduce pdfreader scrollbar height + width
- [ ] remove hardcoded heights using vh
- [ ] remove the weird dragging thing on area-highlight => prob better to rebuilt the library. =>

### Low priority

- [ ] replace prisma w. drizzle and use edge runtime for chat
- [ ] setup permissions inside liveblocks dashboard
- [ ] fix `.tippy-arrow` appearing on screen at all times => added a temp fix. still appears when hovered over the pdf reader
- [ ] areahighlight from pdf => imagelink stored on editor is base64 one => possible soln: store it as base64 to the notes, then in the same addhighlighttonotes function upload it to uploadthing, and then update the url of the block in the notes.
- [ ] abstract userIsOwner and userHasAccess (either collab or owner) to a separate trpc procedure.

## Known bug

- new file w. blank editor => u cant add highlight => open issue https://github.com/TypeCellOS/BlockNote/issues/366

## FEATURE SUGGESTIONS

- [ ] maybe switch file uploading to cloudinary => also provides the getFirstPage of pdf thing. (see whether i should save this or call this every time => on how much resource it takes)
- [ ] fix seo stuff, use next-seo
- [ ] store highlights as plain json. it was super dumb to store it as separate tables.
- [ ] have a "summarise" text option right next to highlight text on selecting the text.

## Features to pitch

- custom blocks in editor
- highlights block which on click takes you to that highlight on the doc.
- download as markdown
- collaborator

## Setting up guide

### Pinecone

- Create index => Dimensions = 768, Metric = Cosine

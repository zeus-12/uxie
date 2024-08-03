# [Uxie](https://uxie.vercel.app)

[![thumbnail](./public/thumbnail.png)](https://www.youtube.com/watch?v=m97zcPWSceU)

PDF reader app designed to revolutionise your learning experience!

🚀 Developed with features like:

- 📝 Annotation, note-taking, and collaboration tools
- 📚 Integrates with LLM for enhanced learning
- 💡 Generates flashcards with LLM feedback

Originally started as a hackathon project which I ended up winning 🥇!Uxie has since evolved with even more exciting features.  
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

## Features:

- Note taking, later download the note as markdown
- Summarise, ask questions about the PDFs
- Chat and collab with other
- custom blocks in editor
- highlights block which on click takes you to that highlight on the doc.
- AI-powered text autocompletion
- Craft simple flashcards to test your knowledge, answer questions, and receive instant feedback through AI evaluation.

### Bugs

- [ ] add max length for all input boxes chat, flashcards, feedback, notes.
- [ ] for area highlights, create a custom component with:

1. imagelink stored on editor is base64 one => possible soln: store it as base64 to the notes, then in the same addhighlighttonotes function upload it to uploadthing, and then
   update the url of the block in the notes. => would prob need to create a custom block for this, else there'd be a noticable lag. => [issue fixed!](https://github.com/TypeCellOS/BlockNote/issues/410)
2. and the yellow leftborder which takes to the highlight on click

- [ ] implement ratelimit using redis kv => checkout upstash
- [ ] profile how long pinecone takes for retrieval of embeddings, and maybe look into upstash embedding storage for this (or pgvector?)
- [ ] add download flashcards in csv,anki format ( apkg format), also add dl notes in pdf format ([html2pdf lib](https://ekoopmans.github.io/html2pdf.js/) should work)
- [ ] better error,loading pages => abstract this logic to hook / component
- [ ] editor loads with empty data before the data is loaded.
- [ ] see if u can see all the users (also typing status for chat: [refer](https://github.com/konradhy/build-jotion/blob/master/components/editor.tsx#L93)) in the liveblocks room, (and display it at top)
- [ ] fix `.tippy-arrow` appearing on screen at all times => added a temp fix. still appears when hovered over the pdf reader
- [ ] abstract userIsOwner and userHasAccess (either collab or owner) logic.
      progress:
      => api called `experimental_standaloneMiddleware` but

      1. it requries the types for the entire input, the only way seems to be putting any for the rest => losing typesafety for the whole route
      2. most times data is returned from this, so query will also run twice

  solution seems to be => create separate helper functions (take where, select, etc as params: use relevant prisma types to match each.)

- [ ] remove the empty block => https://github.com/TypeCellOS/BlockNote/issues/631

## New ideas

- [ ] use background runner or something and do long-polling
- [ ] see if the liveblocks stuff can be replaced w. sockets [refer](https://www.blocknotejs.org/docs/real-time-collaboration#yjs-providers)
  - [ ] for now -> If no collab then fetch from DB, else fetch from liveblocks. Also, Always store notes to DB
- [ ] Run the seogets script
- [ ] figure out saving the first page, and doing ocr (maybe locally)

### Pinecone Setting up guide

- Create index => Dimensions = 768, Metric = Cosine

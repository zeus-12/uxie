## Deployed at [https://uxie.vercel.app](https://uxie.vercel.app)

### Built using

- **Nextjs** App dir For the frontend and serverless api routes
- **Typescript** For type safety
- **Tailwind CSS** For styling
- **ShadcnUI** For components
- **Supabase** As the database
- **Prisma** As the ORM
- **Novel** for note taking

### Features:

- **Website**:
  - Note taking
  - Summarise PDFs
  - Chat and collab with other
  - Export highlights of your pdf

## TODOS

- [x] copying text from pdf ignores linebreaks
- [x] add images to some free provider or cloudinary: use cloudinary for storage => also provides the getFirstPage of pdf thing. (see whether i should save this or call this every time => on how much resource it takes)
- [ ] fix linking to the highlighted part for highlighted text on notes.
- [ ] integrate ai => chrome extension + custom llm
- [ ] heck how to export the notes directly to notion? (using notion api or some plugin??) also other note taking apps (obsidian,etc) : add a download as markdown feature for starters
- [ ] do similar to https://codesandbox.io/s/react-resizable-layout-jy3vhk?fontsize=14&hidenavigation=1&theme=dark&file=/src/components/IdeClone.tsx for the readerscreen
- [ ] integrate yjs or whatever for realtime note editing for blocknotes (eg already existing)

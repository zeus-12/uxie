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

- copying text from pdf ignores linebreaks
- add image to notes on highlighting
- image doesnt seem to be supported on the new editor, look into fixing it,
- fix linking to the highlighted part for highlighted text on notes.
- use cloudinary for storage => also provides the getFirstPage of pdf thing. (see whether i should save this or call this every time => on how much resource it takes)
- integrate ai => chrome extension + custom llm
- check how to export the notes directly to notion? (using notion api or some plugin??) also other note taking apps (obsidian,etc)

<!-- LOW PRIORITY -->

- integrate yjs or whatever for realtime note editing for blocknotes (eg already existing)
- setup pricing/restrictions and shit
- create onboarding flow => either the page nextauth provides for new registrations, or just bunch of modals on top of each page w. hasOnboarded stored on db/localstorage or smthn

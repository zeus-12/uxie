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
- make sure the datatypes used in the db works as expected
- add image to notes on highlighting
- image doesnt seem to be supported on the new editor, look into fixing it, also check on creating custom block for the highlighted text => should have a way to link to the highlighted part.
- figure out on how to save the notes (to the db??)
- use cloudinary for storage => also provides the getFirstPage of pdf thing. (see whether i should save this or call this every time)
- integrate ai
- check how to export the notes directly to notion? (using notion api or some plugin??) also other note taking apps (obsidian,etc)
- setup pricing/restrictions and shit

<!-- LOW PRIORITY -->

- look into adding liveblocks or something for realtime collab
  - realtime collabs =>
    - edit the notes at the same time
- create onboarding flow => either the page nextauth provides for new registrations, or just bunch of modals on top of each page w. hasOnboarded stored on db/localstorage or smthn

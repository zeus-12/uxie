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
- PDF text-to-speech (local ai models & browser inbuilt) with sentence-by-sentence highlighting. (spent insane amt of hours on this, and super happy with how it turned out :)
- PDF OCR support (English only)
- Craft simple flashcards to test your knowledge, answer questions, and receive instant feedback through AI evaluation.
- Bionic reading mode, RSVP reading mode disable hyperlinks, read-along mode (helping people read), full-screen pdf view.
- SOON => Semantic search, improved RAG (with better results & listing sources -> w intuitive ui), pdf summary, & more :)

### Bugs

- [ ] add proper prompts for each item in custom/ai/popover.tsx
- [ ] build a category/tags system for documents => doesn't matter if ui is bad, just build it
- [ ] implement ratelimit (esp for everything ai related) using redis kv => checkout upstash
- [ ] better error,loading pages
- [ ] fix `.tippy-arrow` appearing on screen at all times => added a temp fix. still appears when hovered over the pdf reader

## New ideas

- [ ] use background runner with long-polling for vectorisation / flashcard gen
- [ ] For area-highlight
      -store it as base64 to the notes, then in the same addHighlightToNote function upload it to uploadthing, and then update the url of the block in the notes. => would prob need to create a custom block for this, else there'd be a noticable lag.
      -add the yellow leftborder which takes to the image highlight on click
- [ ] send page number whenever tool-calling is used, then display it under the text. (which takes to that page on click)
- [ ] store the content of text-highlight and make it available for search (from a cmd+k window, along w separate tab, and maybe also from /f) => prob not useful for image-highlights (or maybe run ocr on image highlights (using tesseract, (scribe is overkill here)) and store that) => prob not useful, since everything gets added to notes already, then searching that is a simple cmd+f.
      or a simple cmd+k inside a document searches through all the text in the notes and on clicking it focuses that. for images itd have prev stored the ocr-ed text there.
- [ ] store highlighted images in uploadthing.

## 🚀 Getting Started

Once you have the application running, you can start using it by following these steps:

1.  **Sign up or log in:** Create a new account or log in with your existing credentials.
2.  **Upload a PDF:** Click the "Upload" button to upload a PDF file from your computer.
3.  **Start learning:** Once the PDF is uploaded, you can start reading, annotating, and using the AI-powered features to enhance your learning experience.

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or later)
- [pnpm](https://pnpm.io/installation)
- A [Supabase](https://supabase.com/) account
- A [Pinecone](https://www.pinecone.io/) account
- An [Uploadthing](https://uploadthing.com/) account

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/zeus-12/uxie.git
    cd uxie
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3.  **Set up environment variables:**

    Copy the `.env.example` file to a new file named `.env` and fill in the required values.

    ```bash
    cp .env.example .env
    ```

    You will need to provide API keys and other configuration details for the following services:

    - `DATABASE_URL`: Your Supabase database connection string.
    - `NEXTAUTH_SECRET`: A secret key for NextAuth.js. You can generate one using `openssl rand -base64 32`.
    - `NEXTAUTH_URL`: The URL of your application (e.g., `http://localhost:3000`).
    - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID.
    - `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret.
    - `UPLOADTHING_SECRET`: Your Uploadthing API key.
    - `UPLOADTHING_APP_ID`: Your Uploadthing app ID.
    - `PINECONE_API_KEY`: Your Pinecone API key.
    - `PINECONE_ENVIRONMENT`: Your Pinecone environment.
    - `PINECONE_INDEX_NAME`: The name of your Pinecone index.
    - `FIREWORKS_API_KEY`: Your Fireworks AI API key.

4.  **Set up the database:**

    - Go to your [Supabase dashboard](https://app.supabase.io/) and create a new project.
    - Get the database connection string from the project settings and add it to your `.env` file.
    - Run the following command to apply the database migrations:

      ```bash
      pnpm prisma db push
      ```

5.  **Set up Pinecone:**

    - Go to your [Pinecone dashboard](https://app.pinecone.io/) and create a new index.
    - Set the dimensions to `768` and the metric to `cosine`.
    - Get your API key and environment from the project settings and add them to your `.env` file.

6.  **Start the development server:**

    ```bash
    pnpm dev
    ```

    The application should now be running at [http://localhost:3000](http://localhost:3000).

## 🤝 Contributing

Contributions are welcome! We appreciate your help in making Uxie even better.

If you have any ideas, suggestions, or bug reports, please open an issue on the [GitHub repository](https://github.com/zeus-12/uxie/issues).

If you want to contribute code, please follow these steps:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and commit them with a clear and descriptive message.
4.  Push your changes to your forked repository.
5.  Open a pull request to the `main` branch of the original repository.

We will review your pull request as soon as possible and provide feedback.

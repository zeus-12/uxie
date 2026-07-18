import { type HighlightPositionType } from "@/types/highlight";

/**
 * Static seed data for the unauthenticated demo experience.
 *
 * Everything the demo shows lives here or in the user's own browser
 * (localStorage). Nothing in this file — or the demo in general — ever touches
 * our backend. The preset PDF is a self-authored, license-clean document served
 * statically from /public/demo, so the flashcards and canned chat below can
 * reference its contents directly.
 */

export interface DemoHighlight {
  id: string;
  position: HighlightPositionType;
}

export interface DemoDoc {
  id: string;
  title: string;
  url: string;
  note: string | null;
  isVectorised: boolean;
  pageCount: number;
  lastReadPage: number;
  highlights: DemoHighlight[];
}

export const DEMO_DOC_SEED: DemoDoc = {
  id: "demo",
  title: "The Art of Reading Deeply",
  url: "/demo.pdf",
  note: null,
  isVectorised: false,
  pageCount: 2,
  lastReadPage: 1,
  highlights: [],
};

export interface DemoFlashcard {
  id: string;
  question: string;
  answer: string;
}

export const DEMO_FLASHCARDS: DemoFlashcard[] = [
  {
    id: "fc-1",
    question: "What is the single greatest upgrade to your reading?",
    answer:
      "Reading with a pencil in hand — highlighting what surprises you, underlining what you disagree with, and writing questions in the margin.",
  },
  {
    id: "fc-2",
    question: "Why shouldn't you highlight everything?",
    answer:
      "A page drowned in yellow is as useless as a blank one. Marking only the load-bearing ideas is itself the work of understanding.",
  },
  {
    id: "fc-3",
    question: "What makes spaced repetition so effective?",
    answer:
      "Testing yourself just as you're about to forget something forces retrieval, and the struggle to remember is what actually builds the memory.",
  },
  {
    id: "fc-4",
    question: "What is the “teach it back” test?",
    answer:
      "Explaining an idea out loud in plain language. Wherever you stumble is the exact seam where your understanding is still thin.",
  },
];

/**
 * Friendly canned replies for the demo chat. They stay light and never pretend
 * to actually read the document — the top banner already makes clear this is a
 * demo, so these don't need to repeat it. The chat cycles through them.
 */
export const DEMO_CHAT_REPLIES: string[] = [
  "That's a great question! ✨ The full version of Uxie reads your PDF and answers with citations. Sign up to give it a real go!",
  "Love it. 🎯 In the full app I'd pull the answer straight from your document — this quick demo just shows you around. Sign up to try the real thing!",
  "Ooh, nice one. 📚 Real answers, grounded in your PDF, are just a sign-up away. Give Uxie a try!",
  "Good thinking! 💡 The complete Uxie digs through your document to answer this properly. Create a free account to see it in action.",
  "Fun question! 🚀 This is just a taster — the full Uxie chats with your actual PDF. Sign up and ask away!",
];

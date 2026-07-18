import Flashcards from "@/components/flashcard";
import { DEMO_FLASHCARDS } from "@/lib/demo/seed";
import { useState } from "react";

/**
 * Reuses the production Flashcards UI end-to-end, but sources a fixed preset
 * deck and grades answers locally (no AI / backend). The look and interactions
 * are identical to the real product.
 */
export default function DemoFlashcards() {
  const [generated, setGenerated] = useState(false);

  const flashcards = generated
    ? DEMO_FLASHCARDS.map((f) => ({ ...f, flashcardAttempts: [] }))
    : [];

  return (
    <Flashcards
      demo={{
        flashcards,
        isGenerating: false,
        onGenerate: () => setGenerated(true),
        evaluate: () => ({
          moreInfo:
            "Answers aren't graded in the demo. In the full version, Uxie's AI reviews your response against the document and gives tailored feedback — expand the answer below to check yourself, and sign up to try real grading.",
        }),
      }}
    />
  );
}

import { DEMO_FLASHCARDS } from "@/lib/demo/seed";
import Flashcards, {
  type FlashcardEvaluation,
} from "@uxie/shared/components/flashcard";
import { type FlashcardFeedback } from "@uxie/shared/components/flashcard/card";
import { useEffect, useState } from "react";

const DEMO_GRADING_MESSAGE =
  "Answers aren't graded in the demo. In the full version, Uxie's AI reviews your response against the document and gives tailored feedback — expand the answer below to check yourself, and sign up to try real grading.";

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

  // Local, no-AI grading: every answer returns the same explanatory note,
  // reset whenever the shown card changes.
  const useEvaluation = (flashcardId: string): FlashcardEvaluation => {
    const [feedback, setFeedback] = useState<FlashcardFeedback>();
    useEffect(() => setFeedback(undefined), [flashcardId]);
    return {
      onEvaluate: () => setFeedback({ moreInfo: DEMO_GRADING_MESSAGE }),
      feedback,
      isEvaluating: false,
    };
  };

  return (
    <Flashcards
      flashcards={flashcards}
      isLoading={false}
      onGenerate={() => setGenerated(true)}
      isGenerating={false}
      useEvaluation={useEvaluation}
    />
  );
}

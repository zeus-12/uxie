import IndividualFlashcard, { type FlashcardFeedback } from "./card";
import FeatureCard from "../other/feature-card";
import { SpinnerPage } from "../ui/spinner";
import { useState } from "react";

export interface FlashcardEvaluation {
  onEvaluate: (userResponse: string) => void;
  feedback: FlashcardFeedback | undefined;
  isEvaluating: boolean;
}

export interface FlashcardAttempt {
  userResponse: string;
  correctResponse: string | null;
  incorrectResponse: string | null;
  moreInfo: string | null;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  flashcardAttempts: FlashcardAttempt[];
}

const Flashcards = ({
  flashcards,
  isLoading,
  onGenerate,
  isGenerating,
  useEvaluation,
}: {
  flashcards: Flashcard[];
  isLoading: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
  useEvaluation: (flashcardId: string) => FlashcardEvaluation;
}) => {
  const [cur, setCur] = useState(0);
  const evaluation = useEvaluation(flashcards[cur]?.id ?? "");

  if (isLoading) return <SpinnerPage />;

  return (
    <div className="h-full">
      {flashcards.length === 0 && (
        <FeatureCard
          isLoading={isGenerating}
          bulletPoints={[
            "✅ Celebrate correct answers.",
            "❌ Address misunderstandings.",
            "ℹ️ Expand your understanding with additional insights.",
          ]}
          onClick={onGenerate}
          buttonText="Generate Flashcards"
          subtext="Test your knowledge and receive instant feedback:"
          title="Transform your study materials into dynamic flashcards!"
        />
      )}

      {flashcards.length > 0 &&
        cur >= 0 &&
        cur < flashcards.length &&
        flashcards[cur] !== undefined && (
          <IndividualFlashcard
            setCurrent={setCur}
            id={flashcards[cur]?.id ?? ""}
            question={flashcards[cur]?.question ?? ""}
            answer={flashcards[cur]?.answer ?? ""}
            total={flashcards.length}
            current={cur + 1}
            attempts={flashcards[cur]?.flashcardAttempts ?? []}
            onEvaluate={evaluation.onEvaluate}
            feedback={evaluation.feedback}
            isEvaluating={evaluation.isEvaluating}
          />
        )}
    </div>
  );
};
export default Flashcards;

import IndividualFlashcard, {
  type FlashcardAttemptType,
  type FlashcardEvaluation,
} from "@/components/flashcard/card";
import FeatureCard from "@/components/other/feature-card";
import { SpinnerPage } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useRouter } from "next/router";
import { useState } from "react";
import { toast } from "sonner";

export interface FlashcardItem {
  id: string;
  question: string;
  answer: string;
  flashcardAttempts: FlashcardAttemptType[];
}

/**
 * Supplied by the local-only demo to reuse this exact UI while bypassing the
 * tRPC data source and AI grading. Presence of this single prop is the one,
 * explicit switch into demo mode (all-or-nothing).
 */
export interface FlashcardDemoConfig {
  flashcards: FlashcardItem[];
  onGenerate: () => void;
  isGenerating: boolean;
  evaluate: (userResponse: string) => FlashcardEvaluation;
}

const Flashcards = ({ demo }: { demo?: FlashcardDemoConfig } = {}) => {
  const { query } = useRouter();
  const documentId = query?.docId as string;

  const [cur, setCur] = useState(0);

  const {
    data: queryData,
    isLoading,
    isError,
  } = api.flashcard.getFlashcards.useQuery(
    { documentId },
    { enabled: !demo },
  );

  const { mutate: generateFlashcards, isLoading: isGeneratingMutation } =
    api.flashcard.generateFlashcards.useMutation();

  const utils = api.useContext();

  const flashcards = demo ? demo.flashcards : queryData;
  const isGeneratingFlashcards = demo ? demo.isGenerating : isGeneratingMutation;

  const handleGenerate = () => {
    if (demo) {
      demo.onGenerate();
      return;
    }
    generateFlashcards(
      { documentId },
      {
        onSuccess: () => {
          utils.flashcard.getFlashcards.refetch();
        },
        onError: (err: any) => {
          toast.error(err.message, {
            duration: 3000,
          });
        },
      },
    );
  };

  if (!demo && isLoading) return <SpinnerPage />;
  if (!demo && (isError || !flashcards)) return <div>Something went wrong</div>;
  if (!flashcards) return null;

  return (
    <div className="h-full">
      {flashcards.length === 0 && (
        <FeatureCard
          isLoading={isGeneratingFlashcards}
          bulletPoints={[
            "✅ Celebrate correct answers.",
            "❌ Address misunderstandings.",
            "ℹ️ Expand your understanding with additional insights.",
          ]}
          onClick={handleGenerate}
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
            evaluate={demo?.evaluate}
          />
        )}
    </div>
  );
};
export default Flashcards;

import IndividualFlashcard from "@/components/flashcard/card";
import FeatureCard from "@/components/other/feature-card";
import { SpinnerPage } from "@/components/ui/spinner";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { useRouter } from "next/router";
import { useState } from "react";

const Flashcards = () => {
  const { query } = useRouter();
  const documentId = query?.docId as string;

  const [cur, setCur] = useState(0);

  const {
    data: flashcards,
    isLoading,
    isError,
  } = api.flashcard.getFlashcards.useQuery({ documentId });

  const { mutate: generateFlashcards, isLoading: isGeneratingFlashcards } =
    api.flashcard.generateFlashcards.useMutation();

  const utils = api.useContext();

  if (isLoading) return <SpinnerPage />;
  if (isError || !flashcards) return <div>Something went wrong</div>;

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
          onClick={() => {
            generateFlashcards(
              { documentId },
              {
                onSuccess: () => {
                  utils.flashcard.getFlashcards.refetch();
                },
                onError: (err: any) => {
                  toast({
                    title: "Uh-oh",
                    description: err?.message ?? "Something went wrong",
                    variant: "destructive",
                    duration: 3000,
                  });
                },
              },
            );
          }}
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
          />
        )}
    </div>
  );
};
export default Flashcards;

import IndividualFlashcard from "@/components/IndividualFlashcard";
import { Spinner, SpinnerPage } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
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

  const {
    refetch: generateFlashcards,
    isInitialLoading: isGeneratingFlashcards,
  } = api.flashcard.generateFlashcards.useQuery(
    {
      documentId,
    },
    {
      enabled: false,
    },
  );

  if (isError || !flashcards) return <div>Something went wrong</div>;
  if (isLoading) return <SpinnerPage />;

  return (
    <div className="h-full">
      {flashcards.length === 0 && (
        <div className="mx-auto flex h-full max-w-[70%] flex-col items-center justify-center">
          <p className="font-xl  text-center"></p>

          <Button
            className="mt-2"
            disabled={isGeneratingFlashcards}
            onClick={() => {
              generateFlashcards();
            }}
          >
            {isGeneratingFlashcards && <Spinner />}
            Generate Flashcards for this document?
          </Button>

          {/* choose pages, and number of qns */}
        </div>
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

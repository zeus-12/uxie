import IndividualFlashcard from "@/components/Flashcard/IndividualFlashcard";
import { Spinner, SpinnerPage } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
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
        <div className="mx-auto flex h-full w-[90%] max-w-[30rem] flex-col justify-center">
          <p className="text-2xl font-bold tracking-tight">
            Transform your study materials into dynamic flashcards!
          </p>
          <p className="my-2 text-lg font-normal text-gray-400">
            Test your knowledge and receive instant feedback:
          </p>

          <ul>
            <li>✅ Celebrate correct answers.</li>
            <li>❌ Address misunderstandings.</li>
            <li>ℹ️ Expand your understanding with additional insights.</li>
          </ul>

          <Button
            className="mt-4 md:mt-6"
            disabled={isGeneratingFlashcards}
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
          >
            {isGeneratingFlashcards && <Spinner />}
            Generate Flashcards?
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

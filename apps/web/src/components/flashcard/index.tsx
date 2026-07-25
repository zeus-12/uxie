import { api } from "@/lib/api";
import { flashcardFeedbackSchema } from "@uxie/shared/schema/flashcard";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import Flashcards, {
  type FlashcardEvaluation,
} from "@uxie/shared/components/flashcard";
import { useRouter } from "next/router";
import { useRef } from "react";
import { toast } from "sonner";

const Flashcards_ = () => {
  const { query } = useRouter();
  const documentId = query?.docId as string;
  const utils = api.useContext();

  const {
    data: flashcards,
    isLoading,
    isError,
  } = api.flashcard.getFlashcards.useQuery({ documentId });

  const { mutate: generateFlashcards, isLoading: isGenerating } =
    api.flashcard.generateFlashcards.useMutation();

  // One card's streamed evaluation from /api/evaluate. Closes over documentId so
  // it can persist the finished attempt into the flashcards cache.
  const useEvaluation = (flashcardId: string): FlashcardEvaluation => {
    const lastResponseRef = useRef("");
    const {
      object: feedback,
      submit,
      isLoading: isEvaluating,
    } = useObject({
      api: "/api/evaluate",
      schema: flashcardFeedbackSchema,
      onFinish: ({ object }) => {
        if (!object) return;
        utils.flashcard.getFlashcards.setData({ documentId }, (prev) => {
          if (!prev) return prev;
          return prev.map((fc) =>
            fc.id === flashcardId
              ? {
                  ...fc,
                  flashcardAttempts: [
                    ...fc.flashcardAttempts,
                    {
                      userResponse: lastResponseRef.current,
                      correctResponse: object.correctResponse ?? null,
                      incorrectResponse: object.incorrectResponse ?? null,
                      moreInfo: object.moreInfo ?? null,
                      createdAt: new Date(),
                    },
                  ],
                }
              : fc,
          );
        });
      },
      onError: () => {
        toast.error("Something went wrong with the evaluation.", {
          duration: 3000,
        });
      },
    });

    const onEvaluate = (userResponse: string) => {
      lastResponseRef.current = userResponse;
      submit({ flashcardId, docId: documentId, prompt: userResponse });
    };

    return { onEvaluate, feedback, isEvaluating };
  };

  if (isError) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Couldn&apos;t load flashcards. Please try again.
      </p>
    );
  }

  return (
    <Flashcards
      flashcards={flashcards ?? []}
      isLoading={isLoading}
      onGenerate={() =>
        generateFlashcards(
          { documentId },
          {
            onSuccess: () => utils.flashcard.getFlashcards.refetch(),
            onError: (err) => toast.error(err.message, { duration: 3000 }),
          },
        )
      }
      isGenerating={isGenerating}
      useEvaluation={useEvaluation}
    />
  );
};
export default Flashcards_;

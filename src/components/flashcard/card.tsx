import Feedback from "@/components/flashcard/feedback";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { flashcardFeedbackSchema } from "@/schema/flashcard";
import { DeepPartial } from "ai";
import { experimental_useObject as useObject } from "ai/react";
import { ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";
import { toast } from "sonner";

interface FlashcardAttemptType {
  userResponse: string;
  correctResponse: string | null;
  incorrectResponse: string | null;
  moreInfo: string | null;
}

const IndividualFlashcard = ({
  question,
  answer,
  total,
  current,
  setCurrent,
  id,
  attempts,
}: {
  question: string;
  answer: string;
  total: number;
  current: number;
  setCurrent: React.Dispatch<React.SetStateAction<number>>;
  id: string;
  attempts: FlashcardAttemptType[];
}) => {
  const [hasAttempted, setHasAttempted] = useState(false);

  const { query } = useRouter();
  const documentId = query?.docId as string;
  const utils = api.useContext();

  const {
    isLoading,
    object: feedback,
    submit,
  } = useObject({
    schema: flashcardFeedbackSchema,

    onFinish: ({ object }) => {
      utils.flashcard.getFlashcards.setData({ documentId }, (prev) => {
        if (!prev) return prev;
        return prev.map((flashcard) => {
          if (flashcard.id === id) {
            return {
              ...flashcard,
              flashcardAttempts: [
                ...flashcard.flashcardAttempts,
                {
                  userResponse,
                  correctResponse: object?.correctResponse ?? null,
                  incorrectResponse: object?.incorrectResponse ?? null,
                  moreInfo: object?.moreInfo ?? null,
                  createdAt: new Date(),
                },
              ],
            };
          }
          return flashcard;
        });
      });
    },

    onError: (err: any) => {
      console.log(err.message);

      toast.error("Something went wrong with text generation", {
        duration: 3000,
      });
    },
    api: "/api/evaluate",
  });

  const toggleAttempt = () => {
    setHasAttempted((prev) => !prev);
  };

  const [userResponse, setUserResponse] = useState("");

  return (
    <div className="flex h-full flex-col justify-between ">
      <div className="flex-grow overflow-auto">
        {hasAttempted ? (
          <IndividualFlashcardReport
            question={question}
            answer={answer}
            total={total}
            current={current}
            //   think whether or not to show previous attempts in the current report. also think whether to add along w. the question screen
            feedback={feedback}
            isLoading={isLoading}
            toggleAttempt={toggleAttempt}
            userResponse={userResponse}
            setUserResponse={setUserResponse}
          />
        ) : (
          <IndividualFlashcardQuestion
            attempts={attempts}
            setCompletion={() => {}}
            complete={(prompt: string) =>
              submit({ flashcardId: id, docId: documentId, prompt })
            }
            question={question}
            answer={answer}
            toggleAttempt={toggleAttempt}
            userResponse={userResponse}
            setUserResponse={setUserResponse}
          />
        )}
      </div>

      {/* bottom navigation */}
      <div className="flex h-8 items-center justify-between border-t border-gray-100 py-7">
        <Button
          className="flex items-center"
          variant="ghost"
          disabled={current === 1}
          onClick={() => {
            if (hasAttempted) {
              toggleAttempt();
            }
            setUserResponse("");
            setCurrent((prev) => prev - 1);
          }}
        >
          <ChevronLeftIcon className="h-6 w-6 text-gray-600" />
          <span className="ml-2">Back</span>
        </Button>

        <span className="text-gray-500">
          {current} / {total}
        </span>

        <Button
          className="flex items-center"
          variant="ghost"
          disabled={current === total}
          onClick={() => {
            if (hasAttempted) {
              toggleAttempt();
            }
            setUserResponse("");
            setCurrent((prev) => prev + 1);
          }}
        >
          <span className="mr-2">Skip</span>
          <ChevronRightIcon className="h-6 w-6 text-gray-600" />
        </Button>
      </div>
    </div>
  );
};
export default IndividualFlashcard;

const IndividualFlashcardQuestion = ({
  question,
  answer,
  complete,
  toggleAttempt,
  userResponse,
  setUserResponse,
  setCompletion,
  attempts,
}: {
  question: string;
  answer: string;
  complete: (prompt: string) => void;
  toggleAttempt: () => void;
  userResponse: string;
  setUserResponse: React.Dispatch<React.SetStateAction<string>>;
  setCompletion: (completion: string) => void;
  attempts: FlashcardAttemptType[];
}) => {
  return (
    <div className="flex h-full flex-grow flex-col justify-between">
      <div>
        <div className="mb-4 px-2">
          <div className="rounded-t-lg bg-gray-100 p-3">
            <h1 className="text-lg font-semibold">{question}</h1>
          </div>
          <Textarea
            value={userResponse}
            onChange={(e) => setUserResponse(e.target.value)}
            className="h-24 w-full p-2 border-t-0 rounded-b-lg rounded-t-none focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Enter your answer..."
          />

          <div className="mt-2 flex items-center justify-between ">
            <Button
              size="sm"
              disabled={!userResponse}
              onClick={() => {
                toggleAttempt();
                complete(userResponse);
              }}
              className="bg-blue-400 text-white hover:bg-blue-500"
            >
              Answer
            </Button>
            <Button
              onClick={() => {
                toggleAttempt();
                setCompletion("");
              }}
              variant="ghost"
            >
              Don&apos;t know
            </Button>
          </div>
        </div>
      </div>

      <div>
        {attempts.length > 0 && (
          <>
            <h2 className="mb-2 font-semibold text-gray-600">
              Previous attempts
            </h2>

            <Accordion type="single" collapsible>
              {attempts.map((attempt, index) => (
                <AccordionItem value={index.toString()} key={index}>
                  <AccordionTrigger className="px-2 font-semibold">
                    {index + 1}
                  </AccordionTrigger>
                  <AccordionContent className="rounded-md bg-gray-50 p-4">
                    <div className="mb-4 rounded-md bg-[#F7F5FB] p-4">
                      <h4 className="mb-2 flex items-center text-sm font-semibold text-[#5937AB]">
                        Your Response
                      </h4>
                      <p className="text-sm">{attempt.userResponse}</p>
                    </div>
                    <Feedback
                      correctResponse={attempt.correctResponse}
                      wrongResponse={attempt.incorrectResponse}
                      moreInfo={attempt.moreInfo}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </>
        )}
      </div>
    </div>
  );
};

const IndividualFlashcardReport = ({
  question,
  answer,
  total,
  current,
  toggleAttempt,
  feedback,
  isLoading,
  userResponse,
  setUserResponse,
}: {
  question: string;
  answer: string;
  total: number;
  current: number;
  toggleAttempt: () => void;
  feedback:
    | DeepPartial<{
        correctResponse: string;
        incorrectResponse: string;
        moreInfo: string;
      }>
    | undefined;
  isLoading: boolean;
  userResponse: string;
  setUserResponse: React.Dispatch<React.SetStateAction<string>>;
}) => {
  return (
    <>
      <div>
        <div className="mb-2 flex items-center justify-between pl-2">
          <h3 className="text-lg font-semibold">{question}</h3>
          <Button
            title="Try again"
            variant="ghost"
            onClick={() => {
              toggleAttempt();
              setUserResponse("");
            }}
          >
            <RefreshCwIcon className="h-5 w-5" />
          </Button>
        </div>
        {/* <p className="mb-4 text-sm text-gray-500">From page 7</p> */}
        {userResponse && (
          <div className="mb-6 rounded-md bg-[#f7fafc] p-4">
            <p className="mb-2 font-semibold">Your answer</p>
            <p className="text-sm">{userResponse}</p>
          </div>
        )}
        {(isLoading || feedback) && (
          <>
            <h2 className="mb-2 px-2 font-semibold text-gray-600">Feedback</h2>
            <Feedback
              correctResponse={feedback?.correctResponse}
              wrongResponse={feedback?.incorrectResponse}
              moreInfo={feedback?.moreInfo}
            />
          </>
        )}
        <Accordion
          type="single"
          collapsible
          defaultValue={isLoading || feedback ? undefined : "answer"}
        >
          <AccordionItem value="answer">
            <AccordionTrigger className="px-2 font-semibold">
              Answer
            </AccordionTrigger>
            <AccordionContent className="rounded-md bg-gray-100 p-4">
              {answer}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
};

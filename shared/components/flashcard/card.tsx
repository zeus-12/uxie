import Feedback from "./feedback";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Textarea } from "../ui/textarea";
import { ShimmeringText } from "../ui/shimmering-text";
import { cn } from "../../lib/utils";
import type { FlashcardVerdict } from "../../schema/flashcard";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

interface FlashcardAttemptType {
  userResponse: string;
  correctResponse: string | null;
  incorrectResponse: string | null;
  moreInfo: string | null;
  createdAt?: Date | string | number | null;
}

// Streamed feedback may arrive partial, so every field is optional.
export interface FlashcardFeedback {
  verdict?: FlashcardVerdict;
  correctResponse?: string;
  incorrectResponse?: string;
  moreInfo?: string;
}

const VERDICTS: Record<FlashcardVerdict, { label: string; dot: string }> = {
  correct: { label: "Correct", dot: "bg-emerald-600" },
  // A split green/red dot turns to mud at 6px, so partial gets its own colour.
  partial: { label: "Half right", dot: "bg-amber-500" },
  incorrect: { label: "Not quite", dot: "bg-red-600" },
};

const IndividualFlashcard = ({
  question,
  answer,
  total,
  current,
  setCurrent,
  attempts,
  onEvaluate,
  feedback,
  isEvaluating,
}: {
  question: string;
  answer: string;
  total: number;
  current: number;
  setCurrent: React.Dispatch<React.SetStateAction<number>>;
  id: string;
  attempts: FlashcardAttemptType[];
  onEvaluate: (userResponse: string) => void;
  feedback: FlashcardFeedback | undefined;
  isEvaluating: boolean;
}) => {
  const [hasAttempted, setHasAttempted] = useState(false);
  const [userResponse, setUserResponse] = useState("");
  // Feedback outlives the attempt that produced it — the evaluation hook keeps
  // the last object around. Only show it for an attempt we actually submitted,
  // never for a "Don't know" or a fresh card.
  const [isGraded, setIsGraded] = useState(false);

  const reset = () => {
    setHasAttempted(false);
    setIsGraded(false);
    setUserResponse("");
  };

  // Every move between cards starts the next one clean.
  const step = (delta: number) => {
    reset();
    setCurrent((prev) => prev + delta);
  };

  return (
    <div className="flex h-full flex-col">
      <Progress current={current} total={total} />

      {hasAttempted ? (
        <FlashcardReport
          question={question}
          answer={answer}
          feedback={isGraded ? feedback : undefined}
          isEvaluating={isGraded && isEvaluating}
          userResponse={userResponse}
          isLast={current === total}
          onRetry={reset}
          onNext={() => step(1)}
        />
      ) : (
        <FlashcardQuestion
          question={question}
          attempts={attempts}
          userResponse={userResponse}
          setUserResponse={setUserResponse}
          onSubmit={() => {
            setHasAttempted(true);
            setIsGraded(true);
            onEvaluate(userResponse);
          }}
          onGiveUp={() => setHasAttempted(true)}
        />
      )}

      <div className="flex shrink-0 items-center justify-between pt-3 text-[13px] text-muted-foreground">
        <button
          type="button"
          className="flex items-center gap-1 py-1 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          disabled={current === 1}
          onClick={() => step(-1)}
        >
          <ChevronLeftIcon className="h-4 w-4" strokeWidth={1.5} />
          Back
        </button>
        <button
          type="button"
          className="flex items-center gap-1 py-1 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          disabled={current === total}
          onClick={() => step(1)}
        >
          Skip
          <ChevronRightIcon className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};
export default IndividualFlashcard;

const Progress = ({ current, total }: { current: number; total: number }) => (
  <div className="flex shrink-0 items-center gap-2.5">
    <span className="text-xs tabular-nums text-muted-foreground">
      {String(current).padStart(String(total).length, "0")} / {total}
    </span>
    <span className="h-0.5 flex-1 rounded-full bg-muted">
      <span
        className="block h-full rounded-full bg-blue-500 transition-[width] duration-300"
        style={{ width: `${(current / total) * 100}%` }}
      />
    </span>
  </div>
);

const Quote = ({ label, children }: { label: string; children: string }) => (
  <div className="mt-3.5 border-l-2 border-border pl-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <p className="break-words text-sm">{children}</p>
  </div>
);

const FlashcardQuestion = ({
  question,
  attempts,
  userResponse,
  setUserResponse,
  onSubmit,
  onGiveUp,
}: {
  question: string;
  attempts: FlashcardAttemptType[];
  userResponse: string;
  setUserResponse: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: () => void;
  onGiveUp: () => void;
}) => (
  // Scrolls at the panel edge, same as the report view, so an expanded attempt
  // never needs a scrollbar of its own.
  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
    <h2 className="mt-3.5 text-pretty text-[16.5px] font-semibold leading-snug">
      {question}
    </h2>

    <Textarea
      value={userResponse}
      onChange={(e) => setUserResponse(e.target.value)}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && userResponse.trim()) {
          e.preventDefault();
          onSubmit();
        }
      }}
      // Focus is carried by the border alone, like the chat composer. The base
      // Textarea's ring is a near-black shadow at a 2px offset; even recoloured
      // and translucent it smudges at the corners, so it's switched off.
      className="mt-3.5 min-h-[76px] resize-none rounded-xl bg-muted/40 p-3 text-sm transition-[background-color,border-color] duration-150 focus-visible:border-blue-500 focus-visible:bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
      placeholder="Type your answer…"
    />

    <div className="mt-3 flex items-center justify-between">
      <button
        type="button"
        onClick={onGiveUp}
        className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        Don&apos;t know
      </button>
      {/* ⌘↵ submits too — a shortcut, not something the button needs to say. */}
      <button
        type="button"
        disabled={!userResponse.trim()}
        onClick={onSubmit}
        className="rounded-full bg-blue-500 px-4 py-1.5 text-[13.5px] font-medium text-white transition-[colors,transform] hover:bg-blue-600 active:scale-[0.96] disabled:bg-muted disabled:text-muted-foreground"
      >
        Check
      </button>
    </div>

    {attempts.length > 0 && <EarlierAttempts attempts={attempts} />}
  </div>
);

// Parked at the bottom and collapsed to a single line: nothing you wrote before
// is visible until you deliberately open it, so it can't anchor this answer.
// An Accordion rather than a boolean — it brings the open/close animation, and
// the collapsed rows leave the tab order with it.
const EarlierAttempts = ({ attempts }: { attempts: FlashcardAttemptType[] }) => (
  <Accordion type="single" collapsible className="mt-auto shrink-0 pt-4">
    <AccordionItem value="attempts" className="border-b-0 border-t">
      <AccordionTrigger className="py-2.5 text-xs font-normal text-muted-foreground transition-colors hover:text-foreground">
        {attempts.length} earlier attempt{attempts.length === 1 ? "" : "s"}
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        {/* No height cap and no scroller of its own — a second scrollbar inside
            the card is worse than a longer page. The panel already scrolls. */}
        <Accordion type="single" collapsible>
          {attempts.map((attempt, index) => (
            <AccordionItem value={index.toString()} key={index}>
              <AccordionTrigger className="py-2.5 text-[13px] font-normal">
                <span className="flex flex-1 items-center justify-between pr-2">
                  Attempt {index + 1}
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(attempt.createdAt)}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <Quote label="You said">{attempt.userResponse}</Quote>
                <div className="mt-4">
                  <Feedback
                    correctResponse={attempt.correctResponse}
                    wrongResponse={attempt.incorrectResponse}
                    moreInfo={attempt.moreInfo}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

const FlashcardReport = ({
  question,
  answer,
  feedback,
  isEvaluating,
  userResponse,
  isLast,
  onRetry,
  onNext,
}: {
  question: string;
  answer: string;
  feedback: FlashcardFeedback | undefined;
  isEvaluating: boolean;
  userResponse: string;
  isLast: boolean;
  onRetry: () => void;
  onNext: () => void;
}) => {
  const verdict = feedback?.verdict ? VERDICTS[feedback.verdict] : undefined;
  const hasFeedback = Boolean(feedback || isEvaluating);

  // overflow-x-hidden, not auto: the answer reveal briefly pushes content wider
  // than the box, which is where the stray horizontal bar above the footer came
  // from. Nothing in here scrolls sideways, so clip it.
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {question}
      </p>

      {userResponse && <Quote label="You said">{userResponse}</Quote>}

      {verdict && (
        <div className="mt-4">
          <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium">
            <span className={cn("h-1.5 w-1.5 rounded-full", verdict.dot)} />
            {verdict.label}
          </span>
        </div>
      )}

      {hasFeedback && (
        <div className="mt-4">
          {isEvaluating && !feedback ? (
            <Grading />
          ) : (
            <Feedback
              correctResponse={feedback?.correctResponse}
              wrongResponse={feedback?.incorrectResponse}
              moreInfo={feedback?.moreInfo}
            />
          )}
        </div>
      )}

      {/* The feedback already contains the answer, so it only opens itself when
          there is none — the "Don't know" path. */}
      <Accordion
        type="single"
        collapsible
        className="mt-4"
        defaultValue={hasFeedback ? undefined : "answer"}
      >
        <AccordionItem value="answer" className="border-b-0 border-t">
          <AccordionTrigger className="py-2.5 text-[13px] font-normal text-muted-foreground">
            Show answer
          </AccordionTrigger>
          <AccordionContent className="break-words pb-4 text-[13.5px] leading-relaxed">
            {answer}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onRetry}
          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLast}
          className="rounded-full bg-blue-500 px-4 py-1.5 text-[13.5px] font-medium text-white transition-[colors,transform] hover:bg-blue-600 active:scale-[0.96] disabled:bg-muted disabled:text-muted-foreground"
        >
          Next card
        </button>
      </div>
    </div>
  );
};

const Grading = () => (
  <div>
    <div className="flex flex-col gap-2.5">
      {["38%", "92%", "70%"].map((width) => (
        <span
          key={width}
          className="block h-2 animate-pulse rounded bg-muted"
          style={{ width }}
        />
      ))}
    </div>
    <ShimmeringText
      text="Checking your answer…"
      startOnView={false}
      className="mt-3.5 text-[13px]"
    />
  </div>
);

const UNITS: [limit: number, seconds: number, unit: Intl.RelativeTimeFormatUnit][] =
  [
    [60, 1, "second"],
    [3600, 60, "minute"],
    [86400, 3600, "hour"],
    [604800, 86400, "day"],
    [2592000, 604800, "week"],
    [31536000, 2592000, "month"],
    [Infinity, 31536000, "year"],
  ];

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

// Undefined for attempts stored before createdAt was surfaced — the row just
// shows no time rather than a made-up one.
function timeAgo(value: Date | string | number | null | undefined) {
  if (value == null) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;

  const elapsed = Math.max(0, (Date.now() - then) / 1000);
  const [, seconds, unit] = UNITS.find(([limit]) => elapsed < limit)!;
  return RELATIVE.format(-Math.round(elapsed / seconds), unit);
}

import { useCallback, useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import Flashcards, {
  type Flashcard,
  type FlashcardEvaluation,
} from "@uxie/shared/components/flashcard";
import type { FlashcardFeedback } from "../ipc-contract";

// Manages one card's streamed evaluation over IPC; resets when the card changes.
function useFlashcardEvaluation(flashcardId: string): FlashcardEvaluation {
  const [feedback, setFeedback] = useState<FlashcardFeedback | undefined>();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const streamIdRef = useRef<string | null>(null);

  useEffect(() => {
    setFeedback(undefined);
    setIsEvaluating(false);
    streamIdRef.current = null;
  }, [flashcardId]);

  useEffect(() => {
    const offDelta = window.uxieAPI.onFlashcardEvalDelta((sid, partial) => {
      if (sid !== streamIdRef.current) return;
      setFeedback(partial as FlashcardFeedback);
    });
    const offDone = window.uxieAPI.onFlashcardEvalDone((sid, fb) => {
      if (sid !== streamIdRef.current) return;
      setFeedback(fb);
      setIsEvaluating(false);
      streamIdRef.current = null;
    });
    const offError = window.uxieAPI.onFlashcardEvalError((sid) => {
      if (sid !== streamIdRef.current) return;
      setIsEvaluating(false);
      streamIdRef.current = null;
    });
    return () => {
      offDelta();
      offDone();
      offError();
    };
  }, []);

  const onEvaluate = useCallback(
    (userResponse: string) => {
      if (!flashcardId) return;
      const sid = createId();
      streamIdRef.current = sid;
      setFeedback(undefined);
      setIsEvaluating(true);
      window.uxieAPI.evaluateFlashcard(sid, { flashcardId, prompt: userResponse });
    },
    [flashcardId],
  );

  return { onEvaluate, feedback, isEvaluating };
}

export function FlashcardsPanel({ docId }: { docId: string }) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    window.uxieAPI
      .getFlashcards(docId)
      .then((f) => {
        setFlashcards(f as Flashcard[]);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoading(false));
  }, [docId]);

  useEffect(refresh, [refresh]);

  async function onGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      await window.uxieAPI.generateFlashcards(docId);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="h-full">
      {error && <p className="p-2 text-sm text-destructive">{error}</p>}
      <Flashcards
        flashcards={flashcards}
        isLoading={isLoading}
        onGenerate={onGenerate}
        isGenerating={isGenerating}
        useEvaluation={useFlashcardEvaluation}
      />
    </div>
  );
}

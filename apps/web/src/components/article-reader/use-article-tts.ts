import {
  READING_SPEEDS,
  READING_STATUS,
} from "@uxie/shared/components/pdf-reader/constants";
import { useBrowserTts } from "@uxie/shared/hooks/use-browser-tts";
import { useLocalTts } from "@uxie/shared/hooks/use-local-tts";
import { usePdfSettingsStore } from "@uxie/shared/lib/store";
import { getEngineFromVoice } from "@uxie/shared/lib/tts";
import { splitSentences } from "@uxie/shared/lib/tts/utils";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createArticleRange } from "./article-dom";

const SENTENCE_HIGHLIGHT = "uxie-article-tts-sentence";
const WORD_HIGHLIGHT = "uxie-article-tts-word";

type ArticleSentence = {
  blockId: string;
  element: HTMLElement;
  startOffset: number;
  endOffset: number;
  text: string;
};

const buildSentenceModel = (root: HTMLElement) => {
  const sentences: ArticleSentence[] = [];
  const blocks = root.querySelectorAll<HTMLElement>("[data-uxie-block-id]");

  for (const block of blocks) {
    const blockId = block.dataset.uxieBlockId;
    const text = block.textContent ?? "";
    if (!blockId || !text.trim()) continue;

    let searchOffset = 0;
    for (const sentence of splitSentences(text)) {
      const startOffset = text.indexOf(sentence, searchOffset);
      if (startOffset < 0) continue;
      const endOffset = startOffset + sentence.length;
      searchOffset = endOffset;
      if ((sentence.match(/[\p{L}\p{N}]/gu) ?? []).length < 3) continue;
      sentences.push({
        blockId,
        element: block,
        startOffset,
        endOffset,
        text: sentence,
      });
    }
  }

  return sentences;
};

const clearSpeechHighlights = () => {
  CSS.highlights?.delete(SENTENCE_HIGHLIGHT);
  CSS.highlights?.delete(WORD_HIGHLIGHT);
};

export function useArticleTts({
  articleRootRef,
  scrollRootRef,
}: {
  articleRootRef: RefObject<HTMLElement>;
  scrollRootRef: RefObject<HTMLElement>;
}) {
  const [readingStatus, setReadingStatus] = useState(READING_STATUS.IDLE);
  const [currentReadingSpeed, setCurrentReadingSpeed] = useState(1);
  const [followAlongEnabled, setFollowAlongEnabled] = useState(true);
  const sentencesRef = useRef<ArticleSentence[]>([]);
  const sentenceIndexRef = useRef(0);
  const readingRef = useRef(false);
  const operationRef = useRef(0);
  const speedRef = useRef(1);
  const userScrollUntilRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const playAtRef = useRef<(index: number) => Promise<void>>(async () => {});
  const finishSentenceRef = useRef<() => void>(() => {});

  const highlightWord = useCallback(
    (charIndex: number, charLength: number) => {
      const sentence = sentencesRef.current[sentenceIndexRef.current];
      if (!sentence) return;
      const block = articleRootRef.current?.querySelector<HTMLElement>(
        `[data-uxie-block-id="${sentence.blockId}"]`,
      );
      if (!block) return;

      const end = Math.min(
        sentence.text.length,
        charIndex + Math.max(1, charLength),
      );
      const range = createArticleRange({
        block,
        startOffset: sentence.startOffset + charIndex,
        endOffset: sentence.startOffset + end,
      });
      if (!range) return;
      CSS.highlights?.set(WORD_HIGHLIGHT, new Highlight(range));

      if (!followAlongEnabled || Date.now() < userScrollUntilRef.current)
        return;
      const scrollRoot = scrollRootRef.current;
      if (!scrollRoot) return;
      const wordRect = range.getBoundingClientRect();
      const rootRect = scrollRoot.getBoundingClientRect();
      if (
        wordRect.top >= rootRect.top + 80 &&
        wordRect.bottom <= rootRect.bottom - 80
      ) {
        return;
      }
      programmaticScrollRef.current = true;
      sentence.element.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 150);
    },
    [articleRootRef, followAlongEnabled, scrollRootRef],
  );

  const ttsOptions = {
    onWordBoundary: (charIndex: number, charLength: number) =>
      highlightWord(charIndex, charLength),
    onEnd: () => finishSentenceRef.current(),
  };
  const {
    speak: browserSpeak,
    pause: browserPause,
    resume: browserResume,
    stop: browserStop,
    reset: browserReset,
  } = useBrowserTts(ttsOptions);
  const {
    speak: kokoroSpeak,
    pause: kokoroPause,
    resume: kokoroResume,
    stop: kokoroStop,
    reset: kokoroReset,
    setVoice: setKokoroVoice,
  } = useLocalTts("kokoro", ttsOptions);

  const stopEngines = useCallback(() => {
    browserStop();
    kokoroStop();
  }, [browserStop, kokoroStop]);

  const stopReading = useCallback(() => {
    operationRef.current += 1;
    readingRef.current = false;
    stopEngines();
    clearSpeechHighlights();
    setReadingStatus(READING_STATUS.IDLE);
  }, [stopEngines]);

  const playAt = useCallback(
    async (index: number) => {
      const sentence = sentencesRef.current[index];
      const root = articleRootRef.current;
      if (!sentence || !root || !readingRef.current) {
        stopReading();
        return;
      }

      const operation = ++operationRef.current;
      sentenceIndexRef.current = index;
      const block = root.querySelector<HTMLElement>(
        `[data-uxie-block-id="${sentence.blockId}"]`,
      );
      if (!block) {
        void playAtRef.current(index + 1);
        return;
      }

      const sentenceRange = createArticleRange({
        block,
        startOffset: sentence.startOffset,
        endOffset: sentence.endOffset,
      });
      if (sentenceRange) {
        CSS.highlights?.set(SENTENCE_HIGHLIGHT, new Highlight(sentenceRange));
        CSS.highlights?.delete(WORD_HIGHLIGHT);
      }

      if (followAlongEnabled && Date.now() >= userScrollUntilRef.current) {
        programmaticScrollRef.current = true;
        sentence.element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        window.setTimeout(() => {
          programmaticScrollRef.current = false;
        }, 150);
      }

      const voice = usePdfSettingsStore.getState().voice;
      if (getEngineFromVoice(voice) === "kokoro") {
        setKokoroVoice(voice);
        kokoroReset();
        await kokoroSpeak(sentence.text, { speed: speedRef.current });
      } else {
        browserReset();
        await browserSpeak(sentence.text, {
          speed: speedRef.current,
          voice,
        });
      }

      if (operation !== operationRef.current) return;
    },
    [
      articleRootRef,
      browserReset,
      browserSpeak,
      followAlongEnabled,
      kokoroReset,
      kokoroSpeak,
      setKokoroVoice,
      stopReading,
    ],
  );
  playAtRef.current = playAt;

  finishSentenceRef.current = () => {
    if (!readingRef.current) return;
    const nextIndex = sentenceIndexRef.current + 1;
    if (nextIndex >= sentencesRef.current.length) {
      stopReading();
      return;
    }
    void playAtRef.current(nextIndex);
  };

  const startReading = useCallback(
    async (
      _continueReading = false,
      anchor?: { blockId: string; offset: number },
    ) => {
      const root = articleRootRef.current;
      const scrollRoot = scrollRootRef.current;
      if (!root || !scrollRoot) return;

      sentencesRef.current = buildSentenceModel(root);
      if (sentencesRef.current.length === 0) return;

      let startIndex = 0;
      if (anchor) {
        const found = sentencesRef.current.findIndex(
          (sentence) =>
            sentence.blockId === anchor.blockId &&
            anchor.offset >= sentence.startOffset &&
            anchor.offset <= sentence.endOffset,
        );
        if (found >= 0) startIndex = found;
      } else {
        const rootTop = scrollRoot.getBoundingClientRect().top;
        const found = sentencesRef.current.findIndex(
          (sentence) =>
            sentence.element.getBoundingClientRect().bottom > rootTop + 96,
        );
        if (found >= 0) startIndex = found;
      }

      stopEngines();
      readingRef.current = true;
      setReadingStatus(READING_STATUS.READING);
      await playAtRef.current(startIndex);
    },
    [articleRootRef, scrollRootRef, stopEngines],
  );

  const pauseReading = useCallback(() => {
    const voice = usePdfSettingsStore.getState().voice;
    if (getEngineFromVoice(voice) === "kokoro") kokoroPause();
    else browserPause();
    setReadingStatus(READING_STATUS.PAUSED);
  }, [browserPause, kokoroPause]);

  const resumeReading = useCallback(() => {
    const voice = usePdfSettingsStore.getState().voice;
    if (getEngineFromVoice(voice) === "kokoro") void kokoroResume();
    else browserResume();
    setReadingStatus(READING_STATUS.READING);
  }, [browserResume, kokoroResume]);

  const moveSentence = useCallback(
    (direction: -1 | 1) => {
      if (!readingRef.current) return;
      const next = Math.min(
        sentencesRef.current.length - 1,
        Math.max(0, sentenceIndexRef.current + direction),
      );
      operationRef.current += 1;
      stopEngines();
      readingRef.current = true;
      void playAtRef.current(next);
    },
    [stopEngines],
  );

  const handleReadingSpeedChange = useCallback(async () => {
    const currentIndex = READING_SPEEDS.indexOf(speedRef.current);
    const nextSpeed =
      READING_SPEEDS[(currentIndex + 1) % READING_SPEEDS.length] ?? 1;
    speedRef.current = nextSpeed;
    setCurrentReadingSpeed(nextSpeed);
    if (readingRef.current) {
      operationRef.current += 1;
      stopEngines();
      readingRef.current = true;
      await playAtRef.current(sentenceIndexRef.current);
    }
  }, [stopEngines]);

  const notifyUserScroll = useCallback(() => {
    if (!programmaticScrollRef.current) {
      userScrollUntilRef.current = Date.now() + 2_000;
    }
  }, []);

  useEffect(
    () => () => {
      readingRef.current = false;
      stopEngines();
      clearSpeechHighlights();
    },
    [stopEngines],
  );

  return {
    readingStatus,
    currentReadingSpeed,
    followAlongEnabled,
    startReading,
    startFromSelection: (blockId: string, offset: number) =>
      startReading(false, { blockId, offset }),
    pauseReading,
    resumeReading,
    stopReading,
    skipSentence: () => moveSentence(1),
    skipToPreviousSentence: () => moveSentence(-1),
    handleReadingSpeedChange,
    toggleFollowAlong: () => setFollowAlongEnabled((enabled) => !enabled),
    notifyUserScroll,
  };
}

import { usePdfSettingsStore } from "../lib/store";
import { useCallback, useEffect, useRef, useState } from "react";
import { removeAllHighlights, useSentenceReader } from "./use-sentence-reader";

function extractWords(sentence: string): string[] {
  return sentence.split(/\s+/).filter((w) => w.length > 0);
}

function shouldSkipWord(word: string): boolean {
  const hasLetter = /[a-zA-Z0-9]/.test(word);
  return !hasLetter;
}

function isHyphenatedEnd(word: string): boolean {
  return word.endsWith("-");
}

type ProcessedWord = {
  word: string;
  rawStartIndex: number; // Index in raw words array
  rawWordCount: number; // How many raw words this covers (1 or 2 for hyphenated)
};

function processWordsWithHyphenation(words: string[]): ProcessedWord[] {
  const processed: ProcessedWord[] = [];
  let i = 0;

  while (i < words.length) {
    const word = words[i];
    if (!word) {
      i++;
      continue;
    }

    // case where word ends with a hyphen and there's a next word
    if (isHyphenatedEnd(word) && i + 1 < words.length) {
      const nextWord = words[i + 1];
      if (nextWord) {
        processed.push({
          word: word.slice(0, -1) + nextWord,
          rawStartIndex: i,
          rawWordCount: 2,
        });
        i += 2;
        continue;
      }
    }

    processed.push({
      word,
      rawStartIndex: i,
      rawWordCount: 1,
    });
    i++;
  }

  return processed;
}

function getProcessedWordStrings(processed: ProcessedWord[]): string[] {
  return processed.map((p) => p.word);
}

export function useRsvpReader({
  pageCount,
  pageNumber,
}: {
  pageCount: number;
  pageNumber: number;
}) {
  const sentenceReader = useSentenceReader({ pageCount });

  const rsvpWpm = usePdfSettingsStore((state) => state.rsvpWpm);
  const setRsvpOpen = usePdfSettingsStore((state) => state.setRsvpOpen);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isInitialized, setIsInitialized] = useState(false);
  const [followAlongEnabled, setFollowAlongEnabled] = useState(true);

  const wordsRef = useRef<string[]>([]);
  const rawWordsRef = useRef<string[]>([]);
  const sentencesRef = useRef<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const requestRef = useRef(0);
  const lastHighlightedSentenceRef = useRef<number>(-1);
  const currentPageRef = useRef(1);
  const viewedPageRef = useRef(pageNumber);
  viewedPageRef.current = pageNumber;

  const clearPlayInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const loadPage = useCallback(
    (pageNumber: number) => {
      const sentences = sentenceReader.startFromPage(pageNumber);
      if (!sentences) return false;

      const totalSentences = sentenceReader.getTotalSentences();
      const allSentences: string[] = [];
      for (let i = 0; i < totalSentences; i++) {
        const sentence = sentenceReader.getCurrentSentence();
        if (sentence) allSentences.push(sentence.sentence);
        if (i < totalSentences - 1) sentenceReader.advanceToNextSentence();
      }

      sentencesRef.current = allSentences;
      if (allSentences[0]) {
        const raw = extractWords(allSentences[0]);
        rawWordsRef.current = raw;
        wordsRef.current = getProcessedWordStrings(
          processWordsWithHyphenation(raw),
        );
      }

      currentPageRef.current = pageNumber;
      setCurrentPage(pageNumber);
      void sentenceReader.ensureTextFrom(pageNumber + 1);
      setCurrentSentenceIndex(0);
      setCurrentWordIndex(0);
      setIsInitialized(true);
      lastHighlightedSentenceRef.current = -1;

      sentenceReader.startFromPage(pageNumber);

      if (wordsRef.current[0]) {
        setCurrentWord(wordsRef.current[0]);
      }

      return true;
    },
    [sentenceReader],
  );

  const highlightSentenceOnce = useCallback(
    (sentenceIdx: number) => {
      if (lastHighlightedSentenceRef.current === sentenceIdx) {
        return;
      }

      sentenceReader.startFromPage(currentPageRef.current);
      for (let i = 0; i < sentenceIdx; i++) {
        sentenceReader.advanceToNextSentence();
      }
      sentenceReader.highlightCurrentSentence("rsvp");
      lastHighlightedSentenceRef.current = sentenceIdx;
      if (followAlongEnabled) {
        sentenceReader.scrollToCurrentSentence();
      }
    },
    [sentenceReader, followAlongEnabled],
  );

  const updateWordDisplay = useCallback(
    (sentenceIdx: number, wordIdx: number, skipAutoAdvance = false) => {
      const sentence = sentencesRef.current[sentenceIdx];
      if (!sentence) return false;

      const rawWords = extractWords(sentence);
      const processed = processWordsWithHyphenation(rawWords);
      const processedWord = processed[wordIdx];

      if (!processedWord) return false;

      const word = processedWord.word;

      if (shouldSkipWord(word) && !skipAutoAdvance) {
        return false;
      }

      setCurrentWord(word);
      setCurrentSentenceIndex(sentenceIdx);
      setCurrentWordIndex(wordIdx);
      rawWordsRef.current = rawWords;
      wordsRef.current = getProcessedWordStrings(processed);

      highlightSentenceOnce(sentenceIdx);

      const rawStartIdx = processedWord.rawStartIndex;
      const charOffset =
        rawWords.slice(0, rawStartIdx).join(" ").length +
        (rawStartIdx > 0 ? 1 : 0);

      if (processedWord.rawWordCount === 2) {
        const firstRawWord = rawWords[rawStartIdx] || word;
        sentenceReader.highlightWordInSentence(
          charOffset,
          firstRawWord.length,
          "rsvp",
        );

        const secondRawIdx = rawStartIdx + 1;
        const secondCharOffset =
          rawWords.slice(0, secondRawIdx).join(" ").length +
          (secondRawIdx > 0 ? 1 : 0);
        const secondRawWord = rawWords[secondRawIdx] || "";
        sentenceReader.highlightWordInSentence(
          secondCharOffset,
          secondRawWord.length,
          "rsvp",
          false,
        );
      } else {
        const rawWord = rawWords[rawStartIdx] || word;
        sentenceReader.highlightWordInSentence(
          charOffset,
          rawWord.length,
          "rsvp",
        );
      }

      return true;
    },
    [highlightSentenceOnce, sentenceReader],
  );

  const advanceWord = useCallback((): boolean => {
    const words = wordsRef.current;
    let nextWordIdx = currentWordIndex + 1;
    let sentenceIdx = currentSentenceIndex;

    while (nextWordIdx < words.length) {
      const displayed = updateWordDisplay(sentenceIdx, nextWordIdx);
      if (displayed) return true;
      nextWordIdx++;
    }

    let nextSentenceIdx = currentSentenceIndex + 1;
    while (nextSentenceIdx < sentencesRef.current.length) {
      const nextSentence = sentencesRef.current[nextSentenceIdx];
      if (nextSentence) {
        const rawWords = extractWords(nextSentence);
        const processed = processWordsWithHyphenation(rawWords);
        rawWordsRef.current = rawWords;
        wordsRef.current = getProcessedWordStrings(processed);
        lastHighlightedSentenceRef.current = -1;

        for (let i = 0; i < processed.length; i++) {
          const displayed = updateWordDisplay(nextSentenceIdx, i);
          if (displayed) return true;
        }
      }
      nextSentenceIdx++;
    }

    const nextPage = currentPage + 1;
    if (nextPage <= pageCount) {
      if (!sentenceReader.isPageTextKnown(nextPage)) {
        const request = ++requestRef.current;
        const wasPlaying = isPlaying;
        setIsPlaying(false);
        void sentenceReader.ensureTextFrom(nextPage).then(() => {
          if (request !== requestRef.current || !loadPage(nextPage)) return;
          lastHighlightedSentenceRef.current = -1;
          if (updateWordDisplay(0, 0) && wasPlaying) setIsPlaying(true);
        });
        return true;
      }
      const loaded = loadPage(nextPage);
      if (loaded) {
        lastHighlightedSentenceRef.current = -1;
        const displayed = updateWordDisplay(0, 0);
        if (displayed) return true;
      }
    }

    return false;
  }, [
    currentWordIndex,
    currentSentenceIndex,
    currentPage,
    pageCount,
    loadPage,
    updateWordDisplay,
    sentenceReader,
    isPlaying,
  ]);

  const prevWord = useCallback(() => {
    if (currentWordIndex > 0) {
      updateWordDisplay(currentSentenceIndex, currentWordIndex - 1, true);
      return;
    }

    if (currentSentenceIndex > 0) {
      const prevSentence = sentencesRef.current[currentSentenceIndex - 1];
      if (prevSentence) {
        const rawWords = extractWords(prevSentence);
        const processed = processWordsWithHyphenation(rawWords);
        rawWordsRef.current = rawWords;
        wordsRef.current = getProcessedWordStrings(processed);
        lastHighlightedSentenceRef.current = -1;
        updateWordDisplay(currentSentenceIndex - 1, processed.length - 1, true);
      }
    }
  }, [currentWordIndex, currentSentenceIndex, updateWordDisplay]);

  const nextWord = useCallback(() => {
    advanceWord();
  }, [advanceWord]);

  const startFromPage = useCallback(
    async (pageNumber: number): Promise<boolean> => {
      const request = ++requestRef.current;
      await sentenceReader.ensureTextFrom(pageNumber);
      if (request !== requestRef.current) return false;
      const loaded = loadPage(pageNumber);
      if (loaded) {
        lastHighlightedSentenceRef.current = -1;
        const words = wordsRef.current;
        for (let i = 0; i < words.length; i++) {
          const displayed = updateWordDisplay(0, i, true);
          if (displayed) return true;
        }
      }
      return loaded;
    },
    [loadPage, updateWordDisplay, sentenceReader],
  );

  const play = useCallback(() => {
    if (!isInitialized) {
      void startFromPage(viewedPageRef.current).then((started) => {
        if (started) setIsPlaying(true);
      });
      return;
    }
    setIsPlaying(true);
  }, [isInitialized, startFromPage]);

  const pause = useCallback(() => {
    requestRef.current += 1;
    setIsPlaying(false);
    clearPlayInterval();
  }, [clearPlayInterval]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const stop = useCallback(() => {
    requestRef.current += 1;
    setIsPlaying(false);
    clearPlayInterval();
    removeAllHighlights();
    setCurrentWord(null);
    setCurrentSentenceIndex(0);
    setCurrentWordIndex(0);
    setIsInitialized(false);
    lastHighlightedSentenceRef.current = -1;
  }, [clearPlayInterval]);

  const close = useCallback(() => {
    stop();
    setRsvpOpen(false);
  }, [stop, setRsvpOpen]);

  const toggleFollowAlong = useCallback(() => {
    setFollowAlongEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    clearPlayInterval();

    if (!isPlaying) return;

    const interval = 60000 / rsvpWpm;
    intervalRef.current = setInterval(() => {
      const hasMore = advanceWord();
      if (!hasMore) {
        pause();
      }
    }, interval);

    return clearPlayInterval;
  }, [isPlaying, rsvpWpm, advanceWord, clearPlayInterval, pause]);

  return {
    currentWord,
    isPlaying,
    isInitialized,
    currentPage,
    currentSentenceIndex,
    currentWordIndex,
    totalSentences: sentencesRef.current.length,
    totalWords: wordsRef.current.length,
    followAlongEnabled,
    play,
    pause,
    togglePlay,
    stop,
    close,
    prevWord,
    nextWord,
    startFromPage,
    toggleFollowAlong,
  };
}

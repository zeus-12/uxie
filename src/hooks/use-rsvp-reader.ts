import { usePdfSettingsStore } from "@/lib/store";
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
  rawWordCount: number;  // How many raw words this covers (1 or 2 for hyphenated)
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
        // Combine: remove hyphen and join with next word
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

// Helper to get just the words from processed array
function getProcessedWordStrings(processed: ProcessedWord[]): string[] {
  return processed.map((p) => p.word);
}

export function useRsvpReader({ pageCount }: { pageCount: number }) {
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
  const rawWordsRef = useRef<string[]>([]); // Original words before processing (for char offset calculation)
  const sentencesRef = useRef<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHighlightedSentenceRef = useRef<number>(-1);

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
        wordsRef.current = getProcessedWordStrings(processWordsWithHyphenation(raw));
      }

      setCurrentPage(pageNumber);
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
    [sentenceReader]
  );

  const highlightSentenceOnce = useCallback(
    (sentenceIdx: number) => {
      if (lastHighlightedSentenceRef.current === sentenceIdx) {
        return; // Already highlighted this sentence
      }

      sentenceReader.startFromPage(currentPage);
      for (let i = 0; i < sentenceIdx; i++) {
        sentenceReader.advanceToNextSentence();
      }
      sentenceReader.highlightCurrentSentence("rsvp");
      lastHighlightedSentenceRef.current = sentenceIdx;
      if (followAlongEnabled) {
        sentenceReader.scrollToCurrentSentence();
      }
    },
    [currentPage, sentenceReader, followAlongEnabled]
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

      // Auto-skip symbols-only words
      if (shouldSkipWord(word) && !skipAutoAdvance) {
        return false; // Signal to advance
      }

      setCurrentWord(word);
      setCurrentSentenceIndex(sentenceIdx);
      setCurrentWordIndex(wordIdx);
      rawWordsRef.current = rawWords;
      wordsRef.current = getProcessedWordStrings(processed);

      // Only highlight sentence if it changed
      highlightSentenceOnce(sentenceIdx);

      // Calculate the character offset using raw word positions
      // The raw word at rawStartIndex is where this processed word starts in the sentence
      const rawStartIdx = processedWord.rawStartIndex;
      const charOffset = rawWords.slice(0, rawStartIdx).join(" ").length + (rawStartIdx > 0 ? 1 : 0);

      // For the word length, use the original raw word (not the combined one)
      // If it's a hyphenated word, highlight just the first raw word for now
      const rawWord = rawWords[rawStartIdx] || word;

      sentenceReader.highlightWordInSentence(charOffset, rawWord.length, "rsvp");

      return true;
    },
    [highlightSentenceOnce, sentenceReader]
  );

  const advanceWord = useCallback((): boolean => {
    const words = wordsRef.current;
    let nextWordIdx = currentWordIndex + 1;
    let sentenceIdx = currentSentenceIndex;

    // Try to advance within current sentence
    while (nextWordIdx < words.length) {
      const displayed = updateWordDisplay(sentenceIdx, nextWordIdx);
      if (displayed) return true;
      // Word was skipped, try next
      nextWordIdx++;
    }

    // Move to next sentence
    let nextSentenceIdx = currentSentenceIndex + 1;
    while (nextSentenceIdx < sentencesRef.current.length) {
      const nextSentence = sentencesRef.current[nextSentenceIdx];
      if (nextSentence) {
        const rawWords = extractWords(nextSentence);
        const processed = processWordsWithHyphenation(rawWords);
        rawWordsRef.current = rawWords;
        wordsRef.current = getProcessedWordStrings(processed);
        lastHighlightedSentenceRef.current = -1; // Force re-highlight for new sentence

        // Find first non-skip word
        for (let i = 0; i < processed.length; i++) {
          const displayed = updateWordDisplay(nextSentenceIdx, i);
          if (displayed) return true;
        }
      }
      nextSentenceIdx++;
    }

    // Move to next page
    const nextPage = currentPage + 1;
    if (nextPage <= pageCount) {
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

  const play = useCallback(() => {
    if (!isInitialized) return;
    setIsPlaying(true);
  }, [isInitialized]);

  const pause = useCallback(() => {
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
    setIsPlaying(false);
    clearPlayInterval();
    removeAllHighlights();
    setCurrentWord(null);
    setCurrentSentenceIndex(0);
    setCurrentWordIndex(0);
    setIsInitialized(false);
    lastHighlightedSentenceRef.current = -1;
    // Keep panel open - just reset state
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

  const startFromPage = useCallback(
    (pageNumber: number) => {
      const loaded = loadPage(pageNumber);
      if (loaded) {
        lastHighlightedSentenceRef.current = -1;
        // Find first non-skip word
        const words = wordsRef.current;
        for (let i = 0; i < words.length; i++) {
          const displayed = updateWordDisplay(0, i, true);
          if (displayed) return;
        }
      }
    },
    [loadPage, updateWordDisplay]
  );

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

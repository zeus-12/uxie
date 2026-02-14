import { SPEAK_ALONG_STATUS } from "@/components/pdf-reader/speak-along";
import { useLocalTts } from "@/hooks/use-local-tts";
import {
  cleanSentenceForTts,
  useSentenceReader,
} from "@/hooks/use-sentence-reader";
import { usePdfSettingsStore } from "@/lib/store";
import { getEngineFromVoice } from "@/lib/tts";
import { SUPERTONIC_VOICES } from "@/lib/tts/providers/supertonic-provider";
import {
  extractWordsWithPositions,
  isRealWord,
  normalizeWord,
  type WordWithPosition,
} from "@/lib/tts/utils";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SpeakAlongWord = WordWithPosition & {
  displayWord: string;
  parts?: Array<{ charOffset: number; length: number }>;
};

function extractRealWordsWithHyphenation(sentence: string): SpeakAlongWord[] {
  const words = extractWordsWithPositions(sentence).filter((w) =>
    isRealWord(w.word),
  );
  const result: SpeakAlongWord[] = [];
  let i = 0;

  while (i < words.length) {
    const w = words[i]!;
    if (w.word.endsWith("-") && i + 1 < words.length) {
      const next = words[i + 1]!;
      result.push({
        ...w,
        displayWord: w.word.slice(0, -1) + next.word,
        parts: [
          { charOffset: w.charOffset, length: w.word.length },
          { charOffset: next.charOffset, length: next.word.length },
        ],
      });
      i += 2;
    } else {
      result.push({ ...w, displayWord: w.word });
      i++;
    }
  }

  return result;
}

// Word definition types from Free Dictionary API
export type WordDefinition = {
  word: string;
  phonetic?: string;
  phonetics: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
    }>;
  }>;
};

function cleanWordForLookup(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/gi, "");
}

async function fetchWordDefinition(
  word: string,
): Promise<WordDefinition | null> {
  const cleanWord = cleanWordForLookup(word);
  if (!cleanWord || cleanWord.length < 2) return null;

  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`,
  );
  if (!response.ok) return null;

  const data = await response.json();
  return (data[0] as WordDefinition) ?? null;
}

const MAX_LOOK_AHEAD = 2;

export function useSpeakAlong({ pageCount }: { pageCount: number }) {
  const sentenceReader = useSentenceReader({ pageCount });
  const [status, setStatus] = useState<SPEAK_ALONG_STATUS>(
    SPEAK_ALONG_STATUS.IDLE,
  );
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [currentSentence, setCurrentSentence] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isListening, setIsListening] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [showDefinition, setShowDefinition] = useState(false);

  const wordsRef = useRef<SpeakAlongWord[]>([]);
  const currentWordIndexRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const hasShownErrorRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  const cleanWord = currentWord ? cleanWordForLookup(currentWord) : "";
  const { data: wordDefinition, isLoading: isLoadingDefinition } = useQuery({
    queryKey: ["wordDefinition", cleanWord],
    queryFn: () => fetchWordDefinition(currentWord!),
    enabled: showDefinition && !!currentWord && cleanWord.length >= 2,
    staleTime: Infinity,
  });

  const kokoroTts = useLocalTts("kokoro");
  const supertonicTts = useLocalTts("supertonic");

  const currentVoice = usePdfSettingsStore((state) => state.voice);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[SpeakAlong] Speech recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, []);

  const handleSpeechResult = useCallback((transcript: string) => {
    if (!transcript) return;

    const spokenWords = transcript.toLowerCase().split(/\s+/);
    const lastSpoken = normalizeWord(spokenWords[spokenWords.length - 1] || "");

    if (!lastSpoken) return;

    setLastHeard(spokenWords[spokenWords.length - 1] || null);

    const words = wordsRef.current;
    const currentIdx = currentWordIndexRef.current;

    for (let offset = 0; offset <= MAX_LOOK_AHEAD; offset++) {
      const checkIdx = currentIdx + offset;
      if (checkIdx >= words.length) break;

      const wordInfo = words[checkIdx];
      if (!wordInfo) continue;

      const expectedWord = normalizeWord(wordInfo.displayWord);
      if (expectedWord && lastSpoken === expectedWord) {
        currentWordIndexRef.current = checkIdx + 1;
        updateWordDisplayRef.current();
        return;
      }
    }
  }, []);

  const highlightSpeakAlongWord = useCallback(
    (wordInfo: SpeakAlongWord) => {
      if (wordInfo.parts && wordInfo.parts.length > 1) {
        wordInfo.parts.forEach((part, idx) => {
          sentenceReader.highlightWordInSentence(
            part.charOffset,
            part.length,
            "rsvp",
            idx === 0,
          );
        });
      } else {
        sentenceReader.highlightWordInSentence(
          wordInfo.charOffset,
          wordInfo.word.length,
          "rsvp",
        );
      }
    },
    [sentenceReader],
  );

  const updateWordDisplay = useCallback(() => {
    setShowDefinition(false);
    const words = wordsRef.current;
    const index = currentWordIndexRef.current;

    if (index >= words.length) {
      // Move to next sentence
      const next = sentenceReader.advanceToNextSentence();
      if (!next) {
        stopRecognition();
        setStatus(SPEAK_ALONG_STATUS.IDLE);
        toast.success("Finished reading!");
        return;
      }

      // Load new sentence words
      wordsRef.current = extractRealWordsWithHyphenation(next.sentence);
      currentWordIndexRef.current = 0;
      setCurrentSentence(next.sentence);
      setCurrentPage(next.pageNumber);

      const firstWord = wordsRef.current[0];
      if (firstWord) {
        setCurrentWord(firstWord.displayWord);
        sentenceReader.highlightCurrentSentence("tts");
        sentenceReader.scrollToCurrentSentence();
        highlightSpeakAlongWord(firstWord);
      }
      return;
    }

    const wordInfo = words[index];
    if (!wordInfo) return;

    setCurrentWord(wordInfo.displayWord);
    highlightSpeakAlongWord(wordInfo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentenceReader, highlightSpeakAlongWord]);

  const updateWordDisplayRef = useRef(updateWordDisplay);
  updateWordDisplayRef.current = updateWordDisplay;

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  }, []);

  const startRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      toast.error("Speech recognition not supported in this browser");
      return false;
    }

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.[0]?.transcript) {
          transcript += result[0].transcript;
        }
      }
      handleSpeechResult(transcript);
    };

    recognition.onstart = () => {
      setIsListening(true);
      hasShownErrorRef.current = false;
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if still in listening mode
      if (statusRef.current === SPEAK_ALONG_STATUS.LISTENING) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognition.onerror = (event) => {
      console.warn("[SpeakAlong] Speech recognition error:", event.error);
      setIsListening(false);

      if (!hasShownErrorRef.current) {
        hasShownErrorRef.current = true;
        if (event.error === "network") {
          toast.error(
            "Speech recognition not working. Please check browser settings.",
          );
        } else if (event.error === "not-allowed") {
          toast.error(
            "Microphone access denied. Please allow microphone access.",
          );
        } else if (event.error !== "aborted" && event.error !== "no-speech") {
          toast.error(
            `Speech error: ${event.error}. Use arrow keys to advance manually.`,
          );
        }
      }
    };

    try {
      recognition.start();
      return true;
    } catch (err) {
      console.warn("[SpeakAlong] Failed to start recognition:", err);
      return false;
    }
  }, [handleSpeechResult]);

  const loadSentence = useCallback(
    (pageNumber: number) => {
      setShowDefinition(false);
      const sentence = sentenceReader.startFromPage(pageNumber);
      if (!sentence) return false;

      const current = sentenceReader.getCurrentSentence();
      if (!current) return false;

      sentenceReader.highlightCurrentSentence("tts");
      sentenceReader.scrollToCurrentSentence();

      const words = extractRealWordsWithHyphenation(current.sentence);
      wordsRef.current = words;
      currentWordIndexRef.current = 0;

      setCurrentSentence(current.sentence);
      setCurrentPage(current.pageNumber);

      const firstWord = words[0];
      if (firstWord) {
        setCurrentWord(firstWord.displayWord);
        highlightSpeakAlongWord(firstWord);
      }

      return true;
    },
    [sentenceReader, highlightSpeakAlongWord],
  );

  const start = useCallback(
    (pageNumber: number) => {
      const ok = loadSentence(pageNumber);
      if (!ok) {
        toast.error("No text found on this page");
        return;
      }
      setStatus(SPEAK_ALONG_STATUS.LISTENING);
      hasShownErrorRef.current = false;
      startRecognition();
    },
    [loadSentence, startRecognition],
  );

  const stop = useCallback(() => {
    stopRecognition();
    setStatus(SPEAK_ALONG_STATUS.IDLE);
    wordsRef.current = [];
    currentWordIndexRef.current = 0;
    setCurrentWord(null);
    setCurrentSentence(null);
    setLastHeard(null);
    sentenceReader.removeAllHighlights();
  }, [sentenceReader, stopRecognition]);

  const pause = useCallback(() => {
    stopRecognition();
    setStatus(SPEAK_ALONG_STATUS.PAUSED);
  }, [stopRecognition]);

  const resume = useCallback(() => {
    setStatus(SPEAK_ALONG_STATUS.LISTENING);
    hasShownErrorRef.current = false;
    startRecognition();
  }, [startRecognition]);

  const nextWord = useCallback(() => {
    if (
      status !== SPEAK_ALONG_STATUS.LISTENING &&
      status !== SPEAK_ALONG_STATUS.PAUSED
    )
      return;
    currentWordIndexRef.current += 1;
    updateWordDisplay();
  }, [status, updateWordDisplay]);

  const previousWord = useCallback(() => {
    if (
      status !== SPEAK_ALONG_STATUS.LISTENING &&
      status !== SPEAK_ALONG_STATUS.PAUSED
    )
      return;
    currentWordIndexRef.current = Math.max(0, currentWordIndexRef.current - 1);
    updateWordDisplay();
  }, [status, updateWordDisplay]);

  const getTtsInstanceFromEngine = useCallback(
    (engine: string) => {
      if (engine === "kokoro") {
        return kokoroTts;
      } else if (engine === "supertonic") {
        return supertonicTts;
      } else if (engine === "browser") {
        return supertonicTts;
      }
      return null;
    },
    [kokoroTts, supertonicTts],
  );

  const speakCurrentWord = useCallback(async () => {
    if (!currentWord) return;
    const engine = getEngineFromVoice(currentVoice);
    const tts = getTtsInstanceFromEngine(engine);

    if (!tts) return;

    if (engine === "browser") {
      tts.setVoice(SUPERTONIC_VOICES[0].id);
    } else {
      tts.setVoice(currentVoice);
    }

    tts.reset();
    await tts.speak(cleanSentenceForTts(currentWord), { speed: 1 });
  }, [currentWord, getTtsInstanceFromEngine, currentVoice]);

  const updatePage = useCallback(
    (pageNumber: number) => {
      if (
        status === SPEAK_ALONG_STATUS.LISTENING ||
        status === SPEAK_ALONG_STATUS.PAUSED
      ) {
        loadSentence(pageNumber);
      }
    },
    [status, loadSentence],
  );

  const toggleDefinition = useCallback(() => {
    if (!currentWord) return;
    setShowDefinition((prev) => !prev);
  }, [currentWord]);

  return {
    status,
    currentWord,
    currentSentence,
    currentPage,
    isListening,
    lastHeard,
    wordDefinition: wordDefinition ?? null,
    isLoadingDefinition,
    showDefinition,
    start,
    stop,
    pause,
    resume,
    nextWord,
    previousWord,
    speakCurrentWord,
    updatePage,
    toggleDefinition,
  };
}

import {
  READING_MODE,
  READING_SPEEDS,
  READING_STATUS,
} from "@/components/pdf-reader/constants";
import {
  cleanSentenceForTts,
  removeAllHighlights,
  useSentenceReader,
} from "@/hooks/use-sentence-reader";
import { useLocalTts } from "@/hooks/use-local-tts";
import { useTtsBrowser } from "@/hooks/use-tts-browser";
import { api } from "@/lib/api";
import { usePdfSettingsStore } from "@/lib/store";
import { getEngineFromVoice } from "@/lib/tts";
import type { LocalTtsHook } from "@/lib/tts/types";
import { type PDFViewer } from "pdfjs-dist/types/web/pdf_viewer";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";

const SKIP_DEBOUNCE_MS = 300;
const SPEED_CHANGE_DEBOUNCE_MS = 400;

const usePdfReader = ({
  lastReadPage,
  docId,
  pageCount,
}: {
  lastReadPage: number;
  docId: string;
  pageCount: number;
}) => {
  const [readingStatus, setReadingStatus] = useState<READING_STATUS>(
    READING_STATUS.IDLE,
  );
  const [currentReadingSpeed, setCurrentReadingSpeed] = useState(1);
  const [pageNumberInView, setPageNumberInView] = useState<number>(0);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [followAlongEnabled, setFollowAlongEnabled] = useState(true);

  // Page color from store (persisted)
  const pageColour = usePdfSettingsStore((s) => s.pageColour);
  const setPageColour = usePdfSettingsStore((s) => s.setPageColour);

  // Refs
  const pdfViewerRef = useRef<PDFViewer | null>(null);
  const userScrolledRef = useRef(false);
  const isReadingRef = useRef(false);
  const shouldStopRef = useRef(false);
  const currentReadingMode = useRef<READING_MODE>(READING_MODE.PAGE);
  const selectedTextToRead = useRef("");
  const isSkippingRef = useRef(false);

  const currentOperationIdRef = useRef(0);

  const handleAudioEndRef = useRef<() => void>(() => {});
  const scrollToHighlightRef = useRef<() => void>(() => {});

  const sentenceReader = useSentenceReader({ pageCount });

  const ttsParams = {
    onWordBoundary: (
      charIndex: number,
      charLength: number,
      spokenText: string,
    ) => {
      sentenceReader.highlightWord(charIndex, charLength, spokenText);
      scrollToHighlightRef.current();
    },
    onEnd: () => handleAudioEndRef.current(),
  };

  const kokoroTts = useLocalTts("kokoro", ttsParams);

  const browserTts = useTtsBrowser(ttsParams);

  const supertonicTts = useLocalTts("supertonic", ttsParams);

  const getLocalTts = useCallback(
    (engine: string): LocalTtsHook | null => {
      if (engine === "kokoro") return kokoroTts;
      if (engine === "supertonic") return supertonicTts;
      return null;
    },
    [kokoroTts, supertonicTts],
  );

  const resetWordTrackingRef = useRef<() => void>(() => {});
  resetWordTrackingRef.current = sentenceReader.resetWordTracking;

  // Store selectors
  const bionicReadingEnabled = usePdfSettingsStore(
    (s) => s.bionicReadingEnabled,
  );
  const currentVoice = usePdfSettingsStore((s) => s.voice);

  const { mutateAsync } = api.document.updateLastReadPage.useMutation();

  const debouncedUpdateLastReadPage = useDebouncedCallback(
    async (pageNumber: number) => {
      await mutateAsync({ docId, lastReadPage: pageNumber });
    },
    2000,
  );

  const scrollToHighlight = useCallback(() => {
    if (!followAlongEnabled || userScrolledRef.current) return;
    sentenceReader.scrollToCurrentSentence();
  }, [followAlongEnabled, sentenceReader]);

  scrollToHighlightRef.current = scrollToHighlight;

  // Cancel all pending operations
  const cancelAllOperations = useCallback(() => {
    currentOperationIdRef.current++;
    kokoroTts.stop();
    browserTts.stop();
    supertonicTts.stop();
  }, [kokoroTts, browserTts, supertonicTts]);

  const playCurrentSentenceAudio = useCallback(
    async (operationId?: number) => {
      const thisOperationId = operationId ?? currentOperationIdRef.current;

      if (shouldStopRef.current || !isReadingRef.current) return;
      if (thisOperationId !== currentOperationIdRef.current) return;

      const current = sentenceReader.getCurrentSentence();
      if (!current) return;

      const voice = usePdfSettingsStore.getState().voice;
      const engine = getEngineFromVoice(voice);
      const textToSpeak = current.sentenceForTts;

      sentenceReader.resetWordTracking();

      const tts = getLocalTts(engine);
      if (tts) {
        tts.setVoice(voice);
        tts.reset();

        const sentences = sentenceReader.getSentences();
        const currentIdx = sentenceReader.getCurrentIndex();

        for (let i = 1; i <= 2; i++) {
          const nextSentence = sentences[currentIdx + i];
          if (nextSentence) {
            tts.pregenerate(cleanSentenceForTts(nextSentence));
          }
        }

        if (thisOperationId !== currentOperationIdRef.current) return;

        await tts.speak(textToSpeak, { speed: currentReadingSpeed });
      } else {
        browserTts.reset();

        if (thisOperationId !== currentOperationIdRef.current) return;

        await browserTts.speak(textToSpeak, {
          speed: currentReadingSpeed,
          voice: voice,
        });
      }
    },
    [sentenceReader, getLocalTts, browserTts, currentReadingSpeed],
  );

  // Debounced play for skip/speed change
  const debouncedPlayAfterSkip = useDebouncedCallback(async () => {
    isSkippingRef.current = false;
    if (shouldStopRef.current || !isReadingRef.current) return;
    await playCurrentSentenceAudio();
  }, SKIP_DEBOUNCE_MS);

  // Initialize PDF viewer
  const initPdfViewer = useCallback(() => {
    const viewer = window.PdfViewer?.viewer;
    if (!viewer) return;

    pdfViewerRef.current = viewer;
    setPageNumberInView(viewer.currentPageNumber);
    if (viewer.currentScale) setCurrentZoom(viewer.currentScale);

    const handlePageChanging = (e: { pageNumber: number }) => {
      if (e.pageNumber !== pageNumberInView) {
        setPageNumberInView(e.pageNumber);
        debouncedUpdateLastReadPage(e.pageNumber);
      }
    };

    const handlePagesLoaded = () => {
      if (lastReadPage && viewer.currentPageNumber !== lastReadPage) {
        viewer.currentPageNumber = lastReadPage;
      }
      if (viewer.currentScale) setCurrentZoom(viewer.currentScale);
    };

    const handleScaleChanging = (e: { scale: number }) => {
      if (e.scale) setCurrentZoom(e.scale);
    };

    const handleTextLayerRendered = (e: { pageNumber: number }) => {
      document.dispatchEvent(
        new CustomEvent("pdf:textlayerrendered", {
          detail: { pageNumber: e.pageNumber },
        }),
      );
    };

    viewer.eventBus.on("pagechanging", handlePageChanging);
    viewer.eventBus.on("pagesloaded", handlePagesLoaded);
    viewer.eventBus.on("scalechanging", handleScaleChanging);
    viewer.eventBus.on("textlayerrendered", handleTextLayerRendered);
  }, [debouncedUpdateLastReadPage, lastReadPage, pageNumberInView]);

  useEffect(() => {
    initPdfViewer();
    const intervalId = setInterval(() => {
      if (window.PdfViewer?.viewer) {
        initPdfViewer();
        clearInterval(intervalId);
      }
    }, 100);

    return () => {
      clearInterval(intervalId);
      window.PdfViewer?.viewer?.eventBus.off("pagechanging", () => {});
      window.PdfViewer?.viewer?.eventBus.off("pagesloaded", () => {});
      window.PdfViewer?.viewer?.eventBus.off("scalechanging", () => {});
      window.PdfViewer?.viewer?.eventBus.off("textlayerrendered", () => {});
    };
  }, [initPdfViewer]);

  // User scroll tracking
  useEffect(() => {
    const container = document.getElementById("viewerContainer");
    if (!container) return;

    let timeout: NodeJS.Timeout;
    const handleScroll = () => {
      userScrolledRef.current = true;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        userScrolledRef.current = false;
      }, 2000);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(timeout);
    };
  }, []);

  // Background color - apply on load and when changed
  useEffect(() => {
    const apply = () => {
      const target = document.querySelector(".pdfViewer.removePageBorders");
      if (!target) return false;
      applyBackgroundColour(pageColour);
      return true;
    };

    // Try to apply immediately
    if (apply()) {
      // Set up observer for dynamic page loads
      const observer = new MutationObserver(() =>
        applyBackgroundColour(pageColour),
      );
      const target = document.querySelector(".pdfViewer.removePageBorders");
      if (target) observer.observe(target, { childList: true, subtree: true });
      return () => observer.disconnect();
    }

    // Retry until PDF viewer is ready
    const intervalId = setInterval(() => {
      if (apply()) {
        clearInterval(intervalId);
        // Set up observer after successful apply
        const observer = new MutationObserver(() =>
          applyBackgroundColour(pageColour),
        );
        const target = document.querySelector(".pdfViewer.removePageBorders");
        if (target)
          observer.observe(target, { childList: true, subtree: true });
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [pageColour]);

  // Bionic reading
  useEffect(() => {
    const apply = () => {
      const viewer = document.querySelector(".pdfViewer");
      if (!viewer) return false;
      viewer.classList.toggle("bionic-reading-active", bionicReadingEnabled);
      return true;
    };
    if (apply()) return;
    const id = setInterval(() => apply() && clearInterval(id), 100);
    return () => clearInterval(id);
  }, [bionicReadingEnabled]);

  // Voice change handler
  useEffect(() => {
    if (readingStatus !== READING_STATUS.READING) return;

    // Cancel current audio and restart with new voice
    cancelAllOperations();
    const newOperationId = currentOperationIdRef.current;

    // Reset blockIndex to start of current sentence before replaying
    sentenceReader.resetToCurrentSentenceStart();

    // Small delay then restart from current sentence
    setTimeout(() => {
      if (
        isReadingRef.current &&
        !shouldStopRef.current &&
        newOperationId === currentOperationIdRef.current
      ) {
        playCurrentSentenceAudio(newOperationId);
      }
    }, 100);
  }, [currentVoice]); // eslint-disable-line react-hooks/exhaustive-deps

  // === Public API ===

  const startSentenceBySentenceHighlighting = useCallback(
    async (isContinueReading: boolean) => {
      try {
        shouldStopRef.current = false;
        isReadingRef.current = true;
        isSkippingRef.current = false;
        setReadingStatus(READING_STATUS.READING);
        currentReadingMode.current = READING_MODE.PAGE;

        // Cancel any previous operations
        currentOperationIdRef.current++;
        const thisOperationId = currentOperationIdRef.current;

        kokoroTts.reset();
        browserTts.reset();
        supertonicTts.reset();

        const startPage = isContinueReading
          ? sentenceReader.getCurrentPage()
          : pageNumberInView > 0
          ? pageNumberInView
          : 1;

        pdfViewerRef.current?.scrollPageIntoView({ pageNumber: startPage });

        const position = isContinueReading
          ? sentenceReader.getCurrentSentence()
          : sentenceReader.startFromPage(startPage);

        if (!position) {
          toast.error("No text found in remaining pages");
          stopReading();
          return;
        }

        scrollToHighlight();

        if (thisOperationId === currentOperationIdRef.current) {
          await playCurrentSentenceAudio(thisOperationId);
        }
      } catch (err) {
        console.error("PDF Reader error:", err);
        toast.error("An error occurred while reading the document");
        stopReading();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      pageNumberInView,
      sentenceReader,
      scrollToHighlight,
      playCurrentSentenceAudio,
      kokoroTts,
      browserTts,
      supertonicTts,
    ],
  );

  const skipSentence = useCallback(() => {
    if (!isReadingRef.current) return;

    isSkippingRef.current = true;

    // Set status to reading (in case we were paused)
    setReadingStatus(READING_STATUS.READING);

    // Cancel current and increment operation ID
    cancelAllOperations();
    debouncedPlayAfterSkip.cancel();

    const next = sentenceReader.advanceToNextSentence();
    if (next) {
      scrollToHighlight();
      debouncedPlayAfterSkip();
    } else {
      stopReading();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cancelAllOperations,
    debouncedPlayAfterSkip,
    sentenceReader,
    scrollToHighlight,
  ]);

  const skipToPreviousSentence = useCallback(() => {
    if (!isReadingRef.current) return;

    isSkippingRef.current = true;

    cancelAllOperations();
    debouncedPlayAfterSkip.cancel();

    const prev = sentenceReader.goToPreviousSentence();
    if (prev) {
      scrollToHighlight();
      debouncedPlayAfterSkip();
    }
  }, [
    cancelAllOperations,
    debouncedPlayAfterSkip,
    sentenceReader,
    scrollToHighlight,
  ]);

  const pauseReading = useCallback(() => {
    const voice = usePdfSettingsStore.getState().voice;
    const engine = getEngineFromVoice(voice);

    debouncedPlayAfterSkip.cancel();

    const localTts = getLocalTts(engine);
    if (localTts) {
      localTts.pause();
    } else {
      browserTts.pause();
    }

    setReadingStatus(READING_STATUS.PAUSED);
  }, [getLocalTts, browserTts, debouncedPlayAfterSkip]);

  const resumeReading = useCallback(async () => {
    const voice = usePdfSettingsStore.getState().voice;
    const engine = getEngineFromVoice(voice);

    setReadingStatus(READING_STATUS.READING);

    const localTts = getLocalTts(engine);
    if (localTts) {
      if (localTts.canResume()) {
        await localTts.resume();
      } else {
        localTts.reset();
        await playCurrentSentenceAudio();
      }
    } else {
      if (browserTts.status === "paused") {
        browserTts.resume();
      } else {
        browserTts.reset();
        await playCurrentSentenceAudio();
      }
    }
  }, [getLocalTts, browserTts, playCurrentSentenceAudio]);

  const stopReading = useCallback(() => {
    shouldStopRef.current = true;
    isReadingRef.current = false;
    isSkippingRef.current = false;

    // Cancel all operations
    currentOperationIdRef.current++;
    debouncedPlayAfterSkip.cancel();
    cancelAllOperations();

    sentenceReader.reset();
    removeAllHighlights();
    setReadingStatus(READING_STATUS.IDLE);
  }, [cancelAllOperations, debouncedPlayAfterSkip, sentenceReader]);

  const handleAudioEnd = useCallback(() => {
    if (!isReadingRef.current || shouldStopRef.current || isSkippingRef.current)
      return;

    // Continue to next sentence
    const next = sentenceReader.advanceToNextSentence();
    if (next) {
      scrollToHighlight();
      playCurrentSentenceAudio();
    } else {
      stopReading();
    }
  }, [
    sentenceReader,
    scrollToHighlight,
    playCurrentSentenceAudio,
    stopReading,
  ]);

  handleAudioEndRef.current = handleAudioEnd;

  // Debounced speed change handler
  const debouncedSpeedChange = useDebouncedCallback(
    async (newSpeed: number) => {
      const voice = usePdfSettingsStore.getState().voice;
      const engine = getEngineFromVoice(voice);

      const localTts = getLocalTts(engine);
      if (localTts) {
        localTts.changeSpeed(newSpeed);
        if (readingStatus === READING_STATUS.READING) {
          sentenceReader.resetToCurrentSentenceStart();
          await localTts.restartAtNewSpeed(newSpeed);
        }
      } else if (readingStatus === READING_STATUS.READING) {
        browserTts.stop();
        browserTts.reset();
        sentenceReader.resetToCurrentSentenceStart();
        await playCurrentSentenceAudio();
      }
    },
    SPEED_CHANGE_DEBOUNCE_MS,
  );

  const handleReadingSpeedChange = useCallback(async () => {
    const nextIdx =
      (READING_SPEEDS.indexOf(currentReadingSpeed) + 1) % READING_SPEEDS.length;
    const newSpeed = READING_SPEEDS[nextIdx];
    if (!newSpeed) return;

    setCurrentReadingSpeed(newSpeed);
    await debouncedSpeedChange(newSpeed);
  }, [currentReadingSpeed, debouncedSpeedChange]);

  const toggleFollowAlong = useCallback(() => {
    setFollowAlongEnabled((prev) => !prev);
  }, []);

  const handleZoomChange = useCallback((zoom: number) => {
    if (pdfViewerRef.current) {
      pdfViewerRef.current.currentScale = zoom;
      setCurrentZoom(zoom);
    }
  }, []);

  const handlePageChange = useCallback((pageNumber: number) => {
    if (pdfViewerRef.current) {
      pdfViewerRef.current.currentPageNumber = pageNumber;
    }
  }, []);

  const pageColourChangeHandler = useCallback(
    (colour: string) => {
      setPageColour(colour);
      applyBackgroundColour(colour);
    },
    [setPageColour],
  );

  const readSelectedText = useCallback(
    async ({
      text,
    }: {
      text?: string | null;
      readingSpeed?: number;
      readingMode?: READING_MODE;
      continueReadingFromLastPosition?: boolean;
      highlightInsideSameBlockByIndexes?: any;
    }) => {
      const selectedText = text ?? window.getSelection()?.toString();
      if (!selectedText) return;

      shouldStopRef.current = false;
      isReadingRef.current = true;
      isSkippingRef.current = false;
      setReadingStatus(READING_STATUS.READING);
      currentReadingMode.current = READING_MODE.PAGE;

      currentOperationIdRef.current++;
      const thisOperationId = currentOperationIdRef.current;

      kokoroTts.reset();
      browserTts.reset();
      supertonicTts.reset();

      const startPage = pageNumberInView > 0 ? pageNumberInView : 1;
      const position = sentenceReader.startFromTextOnPage(
        startPage,
        selectedText,
      );

      if (!position) {
        toast.error("Could not find the selected text on this page");
        stopReading();
        return;
      }

      scrollToHighlight();

      if (thisOperationId === currentOperationIdRef.current) {
        await playCurrentSentenceAudio(thisOperationId);
      }
    },
    [
      sentenceReader,
      kokoroTts,
      browserTts,
      supertonicTts,
      pageNumberInView,
      scrollToHighlight,
      playCurrentSentenceAudio,
      stopReading,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      if (readingStatus === READING_STATUS.IDLE) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (readingStatus === READING_STATUS.READING) {
            pauseReading();
          } else if (readingStatus === READING_STATUS.PAUSED) {
            resumeReading();
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          skipSentence();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skipToPreviousSentence();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    readingStatus,
    pauseReading,
    resumeReading,
    skipSentence,
    skipToPreviousSentence,
  ]);

  return {
    pageNumberInView,
    currentReadingSpeed,
    readingStatus,
    startSentenceBySentenceHighlighting,
    handleReadingSpeedChange,
    resumeReading,
    stopReading,
    pauseReading,
    skipSentence,
    skipToPreviousSentence,
    handleZoomChange,
    handlePageChange,
    readSelectedText,
    currentZoom,
    pageColour,
    pageColourChangeHandler,
    followAlongEnabled,
    toggleFollowAlong,
  };
};

function applyBackgroundColour(colour: string) {
  document.querySelectorAll(".textLayer").forEach((layer) => {
    if (layer instanceof HTMLElement) {
      layer.style.backgroundColor = colour;
    }
  });
  const viewer = document.querySelector(".pdfViewer.removePageBorders");
  if (viewer instanceof HTMLElement) {
    viewer.style.backgroundColor = colour;
  }
}

export default usePdfReader;

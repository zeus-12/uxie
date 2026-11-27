import {
  READING_MODE,
  READING_SPEEDS,
  READING_STATUS,
} from "../components/pdf-reader/constants";
import { useBrowserTts } from "./use-browser-tts";
import { useLocalTts } from "./use-local-tts";
import {
  cleanSentenceForTts,
  getReaderScrollContainer,
  isProgrammaticScroll,
  removeAllHighlights,
  TEXT_LAYER_COMPLETE,
  useSentenceReader,
} from "./use-sentence-reader";
import { useReaderZoomStore } from "../lib/reader-zoom";
import { usePdfSettingsStore } from "../lib/store";
import { getEngineFromVoice } from "../lib/tts";
import type { LocalTtsHook } from "../lib/tts/types";
import { type PDFViewer } from "pdfjs-dist/types/web/pdf_viewer";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";

const SKIP_DEBOUNCE_MS = 300;
const SPEED_CHANGE_DEBOUNCE_MS = 400;
// The provider caches five clips, so this stays well inside it.
const PREGENERATE_AHEAD = 2;

const usePdfReader = ({
  lastReadPage,
  zoomLevel,
  docId,
  pageCount,
  viewer,
  reflowed = false,
  onSaveReaderState,
}: {
  lastReadPage: number;
  // null means "auto" — the viewer's own fit-to-width default.
  zoomLevel: number | null;
  docId: string;
  pageCount: number;
  // Passed in rather than read off a global, so opening a second document binds
  // to its viewer instead of the previous, discarded one.
  viewer: PDFViewer | null;
  reflowed?: boolean;
  onSaveReaderState?: (state: {
    lastReadPage?: number;
    zoomLevel?: number;
  }) => void;
}) => {
  const [readingStatus, setReadingStatus] = useState<READING_STATUS>(
    READING_STATUS.IDLE,
  );
  const [currentReadingSpeed, setCurrentReadingSpeed] = useState(1);
  const readingStatusRef = useRef(readingStatus);
  readingStatusRef.current = readingStatus;
  // A sentence ended while paused and waiting for the next page's text.
  const advanceOnResumeRef = useRef(false);
  const pendingAdvanceRef = useRef<number | null>(null);
  // Both start unknown so the toolbar can't show a page or zoom we aren't on.
  const [pageNumberInView, setPageNumberInView] = useState(0);
  const [currentZoom, setCurrentZoom] = useState<number | null>(zoomLevel);
  // Seeded from the persisted zoom so the first layout is already correct.
  const [pdfScaleValue, setPdfScaleValue] = useState(
    zoomLevel != null ? String(zoomLevel) : "auto",
  );
  const [followAlongEnabled, setFollowAlongEnabled] = useState(true);

  const pageColour = usePdfSettingsStore((s) => s.pageColour);
  const setPageColour = usePdfSettingsStore((s) => s.setPageColour);

  const pdfViewerRef = useRef<PDFViewer | null>(null);
  const userScrolledRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isReadingRef = useRef(false);
  const shouldStopRef = useRef(false);
  const currentReadingMode = useRef<READING_MODE>(READING_MODE.PAGE);
  const selectedTextToRead = useRef("");
  const isSkippingRef = useRef(false);

  const currentOperationIdRef = useRef(0);

  const handleAudioEndRef = useRef<() => void>(() => {});
  const scrollToHighlightRef = useRef<() => void>(() => {});
  const keepWordVisibleRef = useRef<() => void>(() => {});

  const sentenceReader = useSentenceReader({ pageCount });

  const ttsParams = {
    onWordBoundary: (
      charIndex: number,
      charLength: number,
      spokenText: string,
    ) => {
      sentenceReader.highlightWord(charIndex, charLength, spokenText);
      keepWordVisibleRef.current();
    },
    onEnd: () => handleAudioEndRef.current(),
  };

  const kokoroTts = useLocalTts("kokoro", ttsParams);

  const browserTts = useBrowserTts(ttsParams);

  const getLocalTts = useCallback(
    (engine: string): LocalTtsHook | null => {
      if (engine === "kokoro") return kokoroTts;
      return null;
    },
    [kokoroTts],
  );

  const resetWordTrackingRef = useRef<() => void>(() => {});
  resetWordTrackingRef.current = sentenceReader.resetWordTracking;

  const bionicReadingEnabled = usePdfSettingsStore(
    (s) => s.bionicReadingEnabled,
  );
  const currentVoice = usePdfSettingsStore((s) => s.voice);

  // Restoring fires `pagechanging` with the value we just read; tracking what's
  // stored keeps every document open from becoming a redundant write.
  const persistedPageRef = useRef(lastReadPage);

  const debouncedUpdateLastReadPage = useDebouncedCallback(
    (pageNumber: number) => {
      if (pageNumber === persistedPageRef.current) return;
      persistedPageRef.current = pageNumber;
      onSaveReaderState?.({ lastReadPage: pageNumber });
    },
    2000,
  );

  // Coalesces a slider drag into one write.
  const debouncedUpdateZoomLevel = useDebouncedCallback((zoom: number) => {
    onSaveReaderState?.({ zoomLevel: zoom });
  }, 2000);

  const scrollToHighlight = useCallback(() => {
    if (!followAlongEnabled || userScrolledRef.current) return;
    sentenceReader.scrollToCurrentSentence();
  }, [followAlongEnabled, sentenceReader]);

  scrollToHighlightRef.current = scrollToHighlight;

  const keepWordVisible = useCallback(() => {
    if (!followAlongEnabled || userScrolledRef.current) return;
    sentenceReader.keepCurrentWordVisible();
  }, [followAlongEnabled, sentenceReader]);

  keepWordVisibleRef.current = keepWordVisible;

  const cancelAllOperations = useCallback(() => {
    currentOperationIdRef.current++;
    kokoroTts.stop();
    browserTts.stop();
  }, [kokoroTts, browserTts]);

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

        for (const upcoming of sentenceReader.peekUpcomingSentences(
          PREGENERATE_AHEAD,
        )) {
          tts.pregenerate(cleanSentenceForTts(upcoming), {
            speed: currentReadingSpeed,
          });
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

  const debouncedPlayAfterSkip = useDebouncedCallback(async () => {
    isSkippingRef.current = false;
    if (shouldStopRef.current || !isReadingRef.current) return;
    await playCurrentSentenceAudio();
  }, SKIP_DEBOUNCE_MS);

  // Keyed on viewer identity so switching documents rebinds.
  useEffect(() => {
    pdfViewerRef.current = viewer;
    if (!viewer) return;

    let hasRestored = false;

    // `pagesinit` is the earliest the page views exist; waiting for
    // `pagesloaded` instead is what made the reader open on page 1 then jump.
    const restore = () => {
      if (hasRestored) return;
      hasRestored = true;

      if (lastReadPage > 0 && lastReadPage <= viewer.pagesCount) {
        viewer.currentPageNumber = lastReadPage;
      }
      setPageNumberInView(viewer.currentPageNumber);
      if (viewer.currentScale) setCurrentZoom(viewer.currentScale);
    };

    const handlePageChanging = ({ pageNumber }: { pageNumber: number }) => {
      setPageNumberInView(pageNumber);
      debouncedUpdateLastReadPage(pageNumber);
    };

    const handleScaleChanging = ({ scale }: { scale: number }) => {
      if (scale) setCurrentZoom(scale);
    };

    const handleTextLayerRendered = ({
      pageNumber,
      source,
    }: {
      pageNumber: number;
      source?: { textLayerDiv?: HTMLElement };
    }) => {
      source?.textLayerDiv?.setAttribute(TEXT_LAYER_COMPLETE, "");
      document.dispatchEvent(
        new CustomEvent("pdf:textlayerrendered", {
          detail: { pageNumber },
        }),
      );
    };

    viewer.eventBus.on("pagechanging", handlePageChanging);
    viewer.eventBus.on("pagesinit", restore);
    viewer.eventBus.on("scalechanging", handleScaleChanging);
    viewer.eventBus.on("textlayerrendered", handleTextLayerRendered);

    // The viewer arrives via state, so `pagesinit` may already have fired — a
    // non-zero page count means we missed it.
    if (viewer.pagesCount > 0) restore();

    return () => {
      viewer.eventBus.off("pagechanging", handlePageChanging);
      viewer.eventBus.off("pagesinit", restore);
      viewer.eventBus.off("scalechanging", handleScaleChanging);
      viewer.eventBus.off("textlayerrendered", handleTextLayerRendered);
      pdfViewerRef.current = null;
    };
  }, [viewer, debouncedUpdateLastReadPage, lastReadPage]);

  // Gated on page views: applied earlier, pdf.js records the scale without
  // using it and its own `pagesinit` apply then skips as a no-op.
  useEffect(() => {
    const currentViewer = pdfViewerRef.current;
    if (currentViewer && currentViewer.pagesCount > 0) {
      currentViewer.currentScaleValue = pdfScaleValue;
    }
  }, [pdfScaleValue, viewer]);

  // The scroll container mounts after this hook does, and the reflow layer
  // takes over scrolling while it shows; the hold outlives the switch.
  useEffect(() => {
    const container = getReaderScrollContainer();
    if (!container) return;

    const handleScroll = () => {
      // Without this the reader reads its own follow-along scroll as the user
      // taking over and stops following.
      if (isProgrammaticScroll()) return;
      userScrolledRef.current = true;
      clearTimeout(userScrollTimeoutRef.current);
      userScrollTimeoutRef.current = setTimeout(() => {
        userScrolledRef.current = false;
      }, 2000);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [viewer, reflowed]);

  useEffect(() => () => clearTimeout(userScrollTimeoutRef.current), []);

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

  useEffect(() => {
    if (readingStatus !== READING_STATUS.READING) return;

    cancelAllOperations();
    const newOperationId = currentOperationIdRef.current;

    sentenceReader.resetToCurrentSentenceStart();

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

  const startSentenceBySentenceHighlighting = useCallback(
    async (isContinueReading: boolean) => {
      try {
        shouldStopRef.current = false;
        isReadingRef.current = true;
        isSkippingRef.current = false;
        setReadingStatus(READING_STATUS.READING);
        currentReadingMode.current = READING_MODE.PAGE;
        advanceOnResumeRef.current = false;

        currentOperationIdRef.current++;
        const thisOperationId = currentOperationIdRef.current;

        kokoroTts.reset();
        browserTts.reset();

        const startPage = isContinueReading
          ? sentenceReader.getCurrentPage()
          : pageNumberInView > 0
          ? pageNumberInView
          : 1;

        pdfViewerRef.current?.scrollPageIntoView({ pageNumber: startPage });
        if (!isContinueReading) await sentenceReader.ensureTextFrom(startPage);
        if (thisOperationId !== currentOperationIdRef.current || shouldStopRef.current) return;

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
    ],
  );

  const skipSentence = useCallback(() => {
    if (!isReadingRef.current) return;

    isSkippingRef.current = true;

    setReadingStatus(READING_STATUS.READING);

    cancelAllOperations();
    debouncedPlayAfterSkip.cancel();

    const operationId = currentOperationIdRef.current;
    pendingAdvanceRef.current = operationId;
    void sentenceReader.prepareNextSentence().then(() => {
      if (pendingAdvanceRef.current === operationId) pendingAdvanceRef.current = null;
      if (operationId !== currentOperationIdRef.current || !isReadingRef.current) {
        isSkippingRef.current = false;
        return;
      }
      if (readingStatusRef.current === READING_STATUS.PAUSED) {
        isSkippingRef.current = false;
        advanceOnResumeRef.current = true;
        return;
      }
      const next = sentenceReader.advanceToNextSentence();
      if (next) {
        scrollToHighlight();
        debouncedPlayAfterSkip();
      } else {
        stopReading();
      }
    });
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

    advanceOnResumeRef.current = false;
    const operationId = currentOperationIdRef.current;
    void sentenceReader.preparePreviousSentence().then(() => {
      if (operationId !== currentOperationIdRef.current || !isReadingRef.current) {
        isSkippingRef.current = false;
        return;
      }
      const prev = sentenceReader.goToPreviousSentence();
      if (!prev) {
        isSkippingRef.current = false;
        return;
      }
      scrollToHighlight();
      if (readingStatusRef.current === READING_STATUS.PAUSED) {
        isSkippingRef.current = false;
        return;
      }
      debouncedPlayAfterSkip();
    });
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

    readingStatusRef.current = READING_STATUS.PAUSED;
    setReadingStatus(READING_STATUS.PAUSED);
  }, [getLocalTts, browserTts, debouncedPlayAfterSkip]);

  const resumeReading = useCallback(async () => {
    const voice = usePdfSettingsStore.getState().voice;
    const engine = getEngineFromVoice(voice);

    readingStatusRef.current = READING_STATUS.READING;
    setReadingStatus(READING_STATUS.READING);

    // The advance waiting on the next page's text sees READING and plays it.
    if (pendingAdvanceRef.current === currentOperationIdRef.current) return;

    if (advanceOnResumeRef.current) {
      advanceOnResumeRef.current = false;
      const next = sentenceReader.advanceToNextSentence();
      if (next) {
        scrollToHighlight();
        await playCurrentSentenceAudio();
      } else {
        stopReading();
      }
      return;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getLocalTts, browserTts, playCurrentSentenceAudio, sentenceReader, scrollToHighlight]);

  const stopReading = useCallback(() => {
    advanceOnResumeRef.current = false;
    shouldStopRef.current = true;
    isReadingRef.current = false;
    isSkippingRef.current = false;

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

    const operationId = currentOperationIdRef.current;
    pendingAdvanceRef.current = operationId;
    void sentenceReader.prepareNextSentence().then(() => {
      if (pendingAdvanceRef.current === operationId) pendingAdvanceRef.current = null;
      if (operationId !== currentOperationIdRef.current) return;
      if (!isReadingRef.current || shouldStopRef.current || isSkippingRef.current) return;
      if (readingStatusRef.current === READING_STATUS.PAUSED) {
        advanceOnResumeRef.current = true;
        return;
      }
      const next = sentenceReader.advanceToNextSentence();
      if (next) {
        scrollToHighlight();
        playCurrentSentenceAudio();
      } else {
        stopReading();
      }
    });
  }, [
    sentenceReader,
    scrollToHighlight,
    playCurrentSentenceAudio,
    stopReading,
  ]);

  handleAudioEndRef.current = handleAudioEnd;

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

  const handleZoomChange = useCallback(
    (zoom: number, persist = true) => {
      setCurrentZoom(zoom);
      setPdfScaleValue(String(zoom));
      if (persist) debouncedUpdateZoomLevel(zoom);
    },
    [debouncedUpdateZoomLevel],
  );

  const handleToolbarZoomChange = useCallback(
    (zoom: number) => {
      const readerZoom = useReaderZoomStore.getState().zoom;
      if (readerZoom) readerZoom.zoomTo(zoom);
      else handleZoomChange(zoom);
    },
    [handleZoomChange],
  );

  const handlePageChange = useCallback((pageNumber: number) => {
    if (pdfViewerRef.current) {
      pdfViewerRef.current.currentPageNumber = pageNumber;
    }
  }, []);

  const pageColourChangeHandler = setPageColour;

  const readSelectedText = useCallback(
    async ({
      text,
      selectionBlockIndex,
      selectionOffsetInBlock,
      selectionPageNumber,
    }: {
      text?: string | null;
      readingSpeed?: number;
      readingMode?: READING_MODE;
      continueReadingFromLastPosition?: boolean;
      highlightInsideSameBlockByIndexes?: any;
      selectionBlockIndex?: number;
      selectionOffsetInBlock?: number;
      selectionPageNumber?: number;
    }) => {
      const selectedText = text ?? window.getSelection()?.toString();
      if (!selectedText) return;

      shouldStopRef.current = false;
      isReadingRef.current = true;
      isSkippingRef.current = false;
      setReadingStatus(READING_STATUS.READING);
      currentReadingMode.current = READING_MODE.PAGE;
      advanceOnResumeRef.current = false;

      currentOperationIdRef.current++;
      const thisOperationId = currentOperationIdRef.current;

      kokoroTts.reset();
      browserTts.reset();

      const startPage =
        selectionPageNumber ?? (pageNumberInView > 0 ? pageNumberInView : 1);
      await sentenceReader.ensureTextFrom(startPage);
      if (thisOperationId !== currentOperationIdRef.current || shouldStopRef.current) return;
      const position = sentenceReader.startFromTextOnPage(
        startPage,
        selectedText,
        selectionBlockIndex,
        selectionOffsetInBlock,
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
    handleToolbarZoomChange,
    handlePageChange,
    readSelectedText,
    currentZoom,
    pdfScaleValue,
    pageColour,
    pageColourChangeHandler,
    followAlongEnabled,
    toggleFollowAlong,
  };
};

export default usePdfReader;

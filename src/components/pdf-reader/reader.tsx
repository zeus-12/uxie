import {
  READING_MODE,
  READING_SPEEDS,
  READING_STATUS,
} from "@/components/pdf-reader/constants";
import PdfHighlighter from "@/components/pdf-reader/pdf-highlighter";
import ReaderBottomSection from "@/components/pdf-reader/reader-bottom-section";
import { SpinnerPage } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { AppRouter } from "@/server/api/root";
import { AddHighlightType } from "@/types/highlight";
import { inferRouterOutputs } from "@trpc/server";
import { useEffect, useRef, useState } from "react";
import { PdfLoader } from "react-pdf-highlighter";
import { useDebouncedCallback } from "use-debounce";

const PdfReader = ({
  addHighlight,
  deleteHighlight,
  doc,
}: {
  addHighlight: ({ content, position }: AddHighlightType) => Promise<void>;
  deleteHighlight: (id: string) => void;
  doc: inferRouterOutputs<AppRouter>["document"]["getDocData"];
}) => {
  const { url: docUrl, pageCount } = doc;

  const [readingStatus, setReadingStatus] = useState<READING_STATUS>(
    READING_STATUS.IDLE,
  );
  const [currentReadingSpeed, setCurrentReadingSpeed] = useState(1);

  // set this to 0 init, and then on-load set it to the last read page
  const [pageNumberInView, setPageNumberInView] = useState<number>(1);
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const currentXIndex = useRef(0);
  const currentYIndex = useRef(0);
  const currentReadingMode = useRef<READING_MODE>(READING_MODE.PAGE);
  const currentPageRead = useRef(1);
  // only for text reading mode
  const selectedTextToRead = useRef("");

  const { mutateAsync } = api.document.updateLastReadPage.useMutation();

  const debouncedUpdateLastReadPage = useDebouncedCallback(
    async (pageNumber: number) => {
      await mutateAsync({ docId: doc.id, lastReadPage: pageNumber });
    },
    2000,
  );

  useEffect(() => {
    speechSynthesisRef.current = window.speechSynthesis;

    return () => {
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  const pdfViewer = window.PdfViewer?.viewer;

  pdfViewer?.eventBus.on("pagechanging", (e: any) => {
    const pageNumber = e.pageNumber;
    if (pageNumber !== pageNumberInView) {
      setPageNumberInView(pageNumber);
      debouncedUpdateLastReadPage(pageNumber);
    }
  });

  // not firing
  pdfViewer?.eventBus.on("pagesinit", () => {
    console.log("pagesinit");

    if (doc.lastReadPage && pdfViewer.currentPageNumber !== doc.lastReadPage) {
      pdfViewer.currentPageNumber = doc.lastReadPage;
    }
  });

  const readSelectedText = async ({
    text,
    readingSpeed,
    addSpanAroundInnerText,
    removeCurrentWordWrapper,
    readingMode,
  }: {
    text?: string | null;
    readingSpeed?: number;
    readingMode: READING_MODE;
    addSpanAroundInnerText?: (startIndex: number, endIndex: number) => void;
    removeCurrentWordWrapper?: () => void;
  }) => {
    if (!speechSynthesisRef.current) return;
    currentReadingMode.current = readingMode;
    const isTextReadingMode = readingMode === READING_MODE.TEXT;
    const continueReadingFromLastPosition = currentXIndex.current !== 0;
    const selectedText = text ?? window.getSelection()?.toString();

    if (!selectedText) return;

    if (isTextReadingMode && !continueReadingFromLastPosition) {
      selectedTextToRead.current = selectedText;
    }

    const textToRead = continueReadingFromLastPosition
      ? (() => {
          // this code is cause even if the current word is half read, it should start from the beginning of the word
          const previousWordLength =
            selectedText.substring(0, currentXIndex.current).split(/\s+/).pop()
              ?.length || 0;
          const startIndex = Math.max(
            0,
            currentXIndex.current - previousWordLength,
          );
          return selectedText.substring(startIndex);
        })()
      : selectedText;

    const lengthDiff = selectedText.length - textToRead.length;

    if (speechSynthesisRef.current.speaking) {
      speechSynthesisRef.current.cancel();
    }

    setReadingStatus(READING_STATUS.READING);

    const utterance = new SpeechSynthesisUtterance(textToRead);

    utterance.voice =
      speechSynthesisRef.current
        .getVoices()
        .find((voice) => voice.name === "Aaron") || null;

    utterance.rate = readingSpeed ?? currentReadingSpeed;
    utteranceRef.current = utterance;

    return new Promise<void>((resolve) => {
      utterance.onboundary = (event) => {
        if (event.name === "word") {
          addSpanAroundInnerText &&
            addSpanAroundInnerText(
              lengthDiff + event.charIndex,
              lengthDiff + event.charIndex + event.charLength,
            );

          const newPosition = event.charIndex + event.charLength + lengthDiff;
          currentXIndex.current = newPosition;
        }
      };

      utterance.onend = (event) => {
        addSpanAroundInnerText &&
          addSpanAroundInnerText(
            lengthDiff + event.charIndex,
            lengthDiff + event.charIndex + event.charLength,
          );

        removeCurrentWordWrapper && removeCurrentWordWrapper();
        currentXIndex.current = 0;
        setReadingStatus(READING_STATUS.IDLE);
        resolve();
      };

      speechSynthesisRef.current?.speak(utterance);
    });
  };

  const removeReadingHighlights = () => {
    const sentenceBlock = document.querySelectorAll(".current-sentence");

    Array.from(sentenceBlock).map((block) => {
      block.classList.remove("current-sentence");
    });

    const wordBlock = document.querySelectorAll(".current-word");
    Array.from(wordBlock).map((block) => {
      block.parentNode?.removeChild(block);
    });
  };

  const startWordByWordHighlighting = async (isContinueReading: boolean) => {
    const startingPageNumber = isContinueReading
      ? currentPageRead.current
      : pageNumberInView;

    for (let pageNum = startingPageNumber; pageNum <= pageCount; pageNum++) {
      currentPageRead.current = pageNum;

      pdfViewer?.scrollPageIntoView({
        pageNumber: pageNum,
      });

      const pageElement = document.querySelector(
        `.page[data-page-number="${pageNum}"]`,
      );

      if (!pageElement) {
        return;
      }

      const textDivs = pageElement.querySelectorAll(
        "span[role='presentation']",
      );

      const blocks = Array.from(textDivs);

      for (let i = currentYIndex.current; i < blocks.length; i++) {
        currentYIndex.current = i;
        const block = blocks[i];

        if (!block) {
          continue;
        }

        block.scrollIntoView({
          block: "center",
        });

        const innerText = block.textContent;

        if (!innerText) {
          return;
        }

        block.classList.add("current-sentence");

        const addSpanAroundInnerText = (
          startIndex: number,
          endIndex: number,
        ) => {
          const span = document.createElement("div");
          span.classList.add("current-word");
          span.innerText = innerText.substring(startIndex, endIndex);

          // this goes instead of the inner text from startindex to endindex
          // const innerHtml = block.innerHTML;

          block.innerHTML =
            innerText.substring(0, startIndex) +
            span.outerHTML +
            innerText.substring(endIndex);
        };

        const removeCurrentWordWrapper = () => {
          const spans = block.querySelectorAll(".current-word");
          spans.forEach((span) => {
            span.parentNode?.removeChild(span);
          });
        };

        await readSelectedText({
          text: innerText,
          addSpanAroundInnerText,
          removeCurrentWordWrapper,
          readingMode: READING_MODE.PAGE,
        });

        block.classList.remove("current-sentence");
        currentXIndex.current = 0;

        currentXIndex.current = 0;
      }

      currentYIndex.current = 0;
    }
  };

  const pauseReading = () => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.pause();
      setReadingStatus(READING_STATUS.PAUSED);
    }
  };

  const stopReading = () => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
    }
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
    }

    setReadingStatus(READING_STATUS.IDLE);

    currentXIndex.current = 0;
    currentYIndex.current = 0;

    removeReadingHighlights();
  };

  const resumeReading = () => {
    if (speechSynthesisRef.current && utteranceRef.current) {
      setReadingStatus(READING_STATUS.READING);
      const isSpeaking = speechSynthesisRef.current.speaking;

      // it just works :)
      // cases ive tested: `pause->change_speed->play, pause->play`
      if (!isSpeaking) {
        if (currentReadingMode.current === READING_MODE.TEXT) {
          readSelectedText({
            text: selectedTextToRead.current,
            readingMode: READING_MODE.TEXT,
          });
        } else {
          startWordByWordHighlighting(true);
        }
      } else {
        speechSynthesisRef.current?.resume();
      }
    }
  };

  const debouncedStartWordByWordHighlighting = useDebouncedCallback(
    startWordByWordHighlighting,
    500,
  );
  const debouncedReadSelectedText = useDebouncedCallback(readSelectedText, 500);

  const handleChangeReadingSpeed = async () => {
    const nextSpeedIndex =
      (READING_SPEEDS.indexOf(currentReadingSpeed) + 1) % READING_SPEEDS.length;
    const newSpeed = READING_SPEEDS[nextSpeedIndex];

    if (!newSpeed) return;
    setCurrentReadingSpeed(newSpeed);

    if (utteranceRef.current && speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
      utteranceRef.current.rate = newSpeed;

      if (readingStatus === READING_STATUS.READING) {
        if (currentReadingMode.current === READING_MODE.TEXT) {
          debouncedReadSelectedText({
            text: selectedTextToRead.current,
            readingSpeed: newSpeed,
            readingMode: READING_MODE.TEXT,
          });
        } else {
          // fake delay such that the word doesnt get repeated immediately
          await debouncedStartWordByWordHighlighting(true);
        }
      }
    }
  };

  return (
    <>
      <PdfLoader url={docUrl} beforeLoad={<SpinnerPage />}>
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            doc={doc}
            addHighlight={addHighlight}
            deleteHighlight={deleteHighlight}
            readSelectedText={readSelectedText}
          />
        )}
      </PdfLoader>
      <ReaderBottomSection
        pageNumberInView={pageNumberInView}
        currentReadingSpeed={currentReadingSpeed}
        readingStatus={readingStatus}
        startWordByWordHighlighting={startWordByWordHighlighting}
        handleChangeReadingSpeed={handleChangeReadingSpeed}
        resumeReading={resumeReading}
        stopReading={stopReading}
        pauseReading={pauseReading}
      />
    </>
  );
};

export default PdfReader;

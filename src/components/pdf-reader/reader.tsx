import {
  READING_MODE,
  READING_STATUS,
} from "@/components/pdf-reader/constants";
import PdfHighlighter from "@/components/pdf-reader/pdf-highlighter";
import ReaderBottomSection from "@/components/pdf-reader/reader-bottom-section";
import { SpinnerPage } from "@/components/ui/spinner";
import { AppRouter } from "@/server/api/root";
import { AddHighlightType } from "@/types/highlight";
import { inferRouterOutputs } from "@trpc/server";
import { type PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { PdfLoader } from "react-pdf-highlighter";

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
  const [selectedTextToRead, setSelectedTextToRead] = useState<string>("");
  const [readingMode, setReadingMode] = useState<READING_MODE>(
    READING_MODE.PAGE,
  );
  const [currentWord, setCurrentWord] = useState("");
  const [currentPosition, setCurrentPosition] = useState(0);

  const [pageNumberInView, setPageNumberInView] = useState<number>(1);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);

  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    speechSynthesisRef.current = window.speechSynthesis;

    return () => {
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  const readSelectedText = ({
    text,
    readingSpeed,
    continueReadingFromLastPosition,
  }: {
    text?: string | null;
    readingSpeed?: number;
    continueReadingFromLastPosition?: boolean;
  }) => {
    if (!speechSynthesisRef.current) return;

    const selectedText = text ?? window.getSelection()?.toString();
    if (!selectedText) return;

    setReadingMode(READING_MODE.TEXT);

    if (!continueReadingFromLastPosition) {
      setSelectedTextToRead(selectedText);
    }

    const textToRead = continueReadingFromLastPosition
      ? selectedText.substring(currentPosition)
      : selectedText;

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

    utterance.onboundary = (event) => {
      if (event.name === "word") {
        setCurrentPosition(currentPosition + event.charIndex);

        const word = textToRead.slice(
          event.charIndex,
          event.charIndex + event.charLength,
        );

        setCurrentWord(word);

        // onend wont work as it'd get called everytime speed is changed (as it calls cancel) => we need to continue reading from the currentIndex in that case
        if (event.charIndex + event.charLength >= textToRead.length) {
          setCurrentPosition(0);
          setCurrentWord("");
          setReadingStatus(READING_STATUS.IDLE);
        }
      }
    };

    speechSynthesisRef.current.speak(utterance);
  };

  useEffect(() => {
    const pdfElement = document.getElementsByClassName("PdfHighlighter")[0];

    if (pdfElement) {
      const handleScroll = () => {
        const pages = Array.from((pdfElement.children[0] as Element).children);

        const pdfPagesInView = pages.reduce((acc, page, index) => {
          const rect = page.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            acc.push(index + 1);
          }
          return acc;
        }, [] as number[]);

        const pdfPageInView = pdfPagesInView[0];
        if (pdfPageInView && pdfPageInView !== pageNumberInView) {
          setPageNumberInView(pdfPageInView);
        }
      };

      // prob throtte this
      pdfElement.addEventListener("scroll", handleScroll);

      return () => {
        pdfElement.removeEventListener("scroll", handleScroll);
      };
    }
  }, [pdf]);

  return (
    <>
      <PdfLoader url={docUrl} beforeLoad={<SpinnerPage />}>
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            setPdf={setPdf}
            doc={doc}
            addHighlight={addHighlight}
            deleteHighlight={deleteHighlight}
            readSelectedText={readSelectedText}
          />
        )}
      </PdfLoader>
      <ReaderBottomSection
        pageNumberInView={pageNumberInView}
        speechSynthesisRef={speechSynthesisRef}
        setReadingStatus={setReadingStatus}
        pdf={pdf}
        pageCount={pageCount}
        setReadingMode={setReadingMode}
        setCurrentPosition={setCurrentPosition}
        setCurrentWord={setCurrentWord}
        utteranceRef={utteranceRef}
        readingMode={readingMode}
        readSelectedText={readSelectedText}
        selectedTextToRead={selectedTextToRead}
        setCurrentReadingSpeed={setCurrentReadingSpeed}
        currentReadingSpeed={currentReadingSpeed}
        readingStatus={readingStatus}
        currentWord={currentWord}
        currentPosition={currentPosition}
      />
    </>
  );
};

export default PdfReader;

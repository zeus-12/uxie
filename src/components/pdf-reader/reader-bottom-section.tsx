import ReaderBottomToolbar from "@/components/pdf-reader/bottom-toolbar";
import {
  READING_MODE,
  READING_SPEEDS,
  READING_STATUS,
} from "@/components/pdf-reader/constants";
import { Button } from "@/components/ui/button";
import { Ban, Pause, Play } from "lucide-react";
import { type PDFDocumentProxy } from "pdfjs-dist";
import { type PDFViewer } from "pdfjs-dist/types/web/pdf_viewer";
import { MutableRefObject, useState } from "react";

const ReaderBottomSection = ({
  pageNumberInView,
  speechSynthesisRef,
  setReadingStatus,
  pdf,
  pageCount,
  setReadingMode,
  setCurrentPosition,
  setCurrentWord,
  utteranceRef,
  readingMode,
  readSelectedText,
  selectedTextToRead,
  setCurrentReadingSpeed,
  currentReadingSpeed,
  readingStatus,
  currentWord,
  currentPosition,
}: {
  pageNumberInView: number;
  speechSynthesisRef: MutableRefObject<SpeechSynthesis | null>;
  setReadingStatus: (status: READING_STATUS) => void;
  pdf: PDFDocumentProxy | null;
  pageCount: number;
  setReadingMode: (mode: READING_MODE) => void;
  setCurrentPosition: (position: number) => void;
  setCurrentWord: (word: string) => void;
  utteranceRef: MutableRefObject<SpeechSynthesisUtterance | null>;
  readingMode: READING_MODE;
  currentWord: string;
  readSelectedText: ({
    text,
    readingSpeed,
    continueReadingFromLastPosition,
  }: {
    text?: string | null;
    readingSpeed?: number;
    continueReadingFromLastPosition?: boolean;
  }) => void;
  selectedTextToRead: string;
  setCurrentReadingSpeed: (speed: number) => void;
  currentReadingSpeed: number;
  readingStatus: READING_STATUS;
  currentPosition: number;
}) => {
  const browserSupportsSpeechSynthesis = "speechSynthesis" in window;
  const [pageNumberToRead, setPageNumberToRead] = useState<number>(1);

  const getPdfContentByPage = async (pageNumber: number) => {
    if (!pdf) return;
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const words = textContent.items.map((item) => {
      if ("str" in item) return item.str;
    });

    return words.join(" ");
  };

  // continueReadingFromLastPosition => used in changing-speed: here we want to continue reading from the last position
  const readDocument = async (
    pageNumber: number,
    readingSpeed?: number,
    continueReadingFromLastPosition?: boolean,
  ) => {
    if (!speechSynthesisRef.current || pageNumber > pageCount || !pdf) {
      setReadingStatus(READING_STATUS.IDLE);
      return;
    }

    setReadingMode(READING_MODE.PAGE);

    // @ts-ignore
    const pdfViewer = window.PdfViewer.viewer as PDFViewer;

    if (pdfViewer) {
      pdfViewer.scrollPageIntoView({
        pageNumber: pageNumber,
      });
    }

    if (speechSynthesisRef.current.speaking) {
      speechSynthesisRef.current.cancel();
    }

    const content = await getPdfContentByPage(pageNumber);

    // happens if the given page has no content
    if (!content) {
      setCurrentPosition(0);
      readDocument(pageNumber + 1);
      setPageNumberToRead(pageNumber + 1);
      setCurrentWord("");
      return;
    }

    setReadingStatus(READING_STATUS.READING);

    const textToRead = continueReadingFromLastPosition
      ? content.substring(currentPosition)
      : content;

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
          readDocument(pageNumber + 1);
          setPageNumberToRead(pageNumber + 1);
          setCurrentWord("");
        }
      }
    };

    speechSynthesisRef.current.speak(utterance);
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
    setReadingStatus(READING_STATUS.IDLE);
    setCurrentWord("");
    setCurrentPosition(0);
  };

  const resumeReading = () => {
    if (speechSynthesisRef.current && utteranceRef.current) {
      setReadingStatus(READING_STATUS.READING);
      const isSpeaking = speechSynthesisRef.current.speaking;

      // it just works :)
      // cases ive tested: `pause->change_speed->play, pause->play`
      if (!isSpeaking) {
        if (readingMode === READING_MODE.TEXT) {
          readSelectedText({
            text: selectedTextToRead,
            continueReadingFromLastPosition: true,
          });
        } else {
          readDocument(pageNumberToRead, currentReadingSpeed, true);
        }
      } else {
        speechSynthesisRef.current.resume();
      }
    }
  };

  const handleChangeReadingSpeed = () => {
    const nextSpeedIndex =
      (READING_SPEEDS.indexOf(currentReadingSpeed) + 1) % READING_SPEEDS.length;
    const newSpeed = READING_SPEEDS[nextSpeedIndex];

    if (!newSpeed) return;
    setCurrentReadingSpeed(newSpeed);

    if (utteranceRef.current && speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
      utteranceRef.current.rate = newSpeed;

      if (readingStatus === READING_STATUS.READING) {
        if (readingMode === READING_MODE.TEXT) {
          readSelectedText({
            text: selectedTextToRead,
            readingSpeed: newSpeed,
            continueReadingFromLastPosition: true,
          });
        } else {
          readDocument(pageNumberToRead, newSpeed, true);
        }
      }
    }
  };

  return (
    <ReaderBottomToolbar
      pageNumberInView={pageNumberInView}
      isAudioDisabled={!browserSupportsSpeechSynthesis}
      currentWord={
        readingStatus !== READING_STATUS.IDLE ? currentWord : undefined
      }
    >
      <div className="gap-1 relative z-50 flex items-center rounded-lg">
        {readingStatus === READING_STATUS.IDLE && (
          <Button
            onClick={() => readDocument(pageNumberInView)}
            variant="ghost"
            className="px-3"
          >
            <Play className="h-5 w-5" />
          </Button>
        )}
        {readingStatus === READING_STATUS.READING && (
          <Button onClick={pauseReading} variant="ghost" className="px-3">
            <Pause className="h-5 w-5" />
          </Button>
        )}

        {readingStatus === READING_STATUS.PAUSED && (
          <Button onClick={resumeReading} variant="ghost" className="px-3">
            <Play className="h-5 w-5" />
          </Button>
        )}

        <Button
          onClick={stopReading}
          disabled={readingStatus === READING_STATUS.IDLE}
          variant="ghost"
          className="px-3"
        >
          <Ban className="h-5 w-5" />
        </Button>

        <Button
          onClick={handleChangeReadingSpeed}
          variant="ghost"
          className="px-3"
        >
          {currentReadingSpeed}x
        </Button>
      </div>
    </ReaderBottomToolbar>
  );
};

export default ReaderBottomSection;

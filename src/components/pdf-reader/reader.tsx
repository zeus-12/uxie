import { getHighlightById } from "@/components/pdf-reader";
import ReaderBottomToolbar from "@/components/pdf-reader/bottom-toolbar";
import {
  HighlightedTextPopover,
  TextSelectionPopover,
} from "@/components/pdf-reader/highlight-popover";
import { Button } from "@/components/ui/button";
import { SpinnerPage } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useChatStore } from "@/lib/store";
import { AppRouter } from "@/server/api/root";
import { HighlightPositionType } from "@/types/highlight";
import { HighlightTypeEnum } from "@prisma/client";
import { inferRouterOutputs } from "@trpc/server";
import { Ban, Pause, Play } from "lucide-react";
import { type PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import {
  AreaHighlight,
  Highlight,
  PdfHighlighter,
  PdfLoader,
  Popup,
} from "react-pdf-highlighter";
import { toast } from "sonner";

interface AddHighlighType {
  content: {
    text?: string;
    image?: string;
  };
  position: HighlightPositionType;
}

const parseIdFromHash = () => document.location.hash.slice(1);

const resetHash = () => {
  document.location.hash = "";
};

let scrollViewerTo = (highlight: any) => {};
const scrollToHighlightFromHash = (
  doc: inferRouterOutputs<AppRouter>["document"]["getDocData"],
) => {
  const highlight = getHighlightById(parseIdFromHash(), doc);

  if (highlight) {
    scrollViewerTo(highlight);
  }
};

enum READING_STATUS {
  IDLE = "IDLE",
  READING = "READING",
  PAUSED = "PAUSED",
}

const READING_SPEEDS = [1, 1.2, 1.4, 1.6, 1.8, 2];

const PdfReader = ({
  addHighlight,
  deleteHighlight,
  doc,
}: {
  addHighlight: ({ content, position }: AddHighlighType) => Promise<void>;
  deleteHighlight: (id: string) => void;
  doc: inferRouterOutputs<AppRouter>["document"]["getDocData"];
}) => {
  const utils = api.useContext();

  const browserSupportsSpeechSynthesis = "speechSynthesis" in window;

  const { url: docUrl, id: docId, pageCount } = doc;

  const highlights = doc.highlights ?? [];

  const { mutate: updateAreaHighlight } =
    api.highlight.updateAreaHighlight.useMutation({
      async onMutate(newHighlight) {
        await utils.document.getDocData.cancel();
        const prevData = utils.document.getDocData.getData();

        // @ts-ignore
        utils.document.getDocData.setData({ docId: docId }, (old) => {
          if (!old) return undefined;
          return {
            ...old,
            highlights: [
              ...old.highlights.filter(
                (highlight) => highlight.id !== newHighlight.id,
              ),
              {
                position: {
                  boundingRect: newHighlight.boundingRect,
                  pageNumber: newHighlight.pageNumber,
                  rects: [],
                },
              },
            ],
          };
        });
        return { prevData };
      },
      onError(err, newPost, ctx) {
        toast.error("Something went wrong", {
          duration: 3000,
        });

        utils.document.getDocData.setData({ docId: docId }, ctx?.prevData);
      },
      onSettled() {
        utils.document.getDocData.invalidate();
      },
    });

  const { sendMessage } = useChatStore();

  const [readingStatus, setReadingStatus] = useState<READING_STATUS>(
    READING_STATUS.IDLE,
  );
  const [readingSpeed, setReadingSpeed] = useState(1);
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [currentWord, setCurrentWord] = useState("");
  const [currentPosition, setCurrentPosition] = useState(0);

  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const getPdfContentByPage = async (pageNumber: number) => {
    if (!pdf) return;
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const words = textContent.items.map((item) => {
      if ("str" in item) return item.str;
    });

    return words.join(" ");
  };

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);

  useEffect(() => {
    speechSynthesisRef.current = window.speechSynthesis;

    return () => {
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  // continueReadingFromLastPosition => used in changing-speed: here we want to continue reading from the last position
  const readDocument = async (
    pageNumber: number,
    continueReadingFromLastPosition?: boolean,
  ) => {
    if (!speechSynthesisRef.current || pageNumber > pageCount || !pdf) {
      setReadingStatus(READING_STATUS.IDLE);
      return;
    }

    // @ts-ignore
    window.PdfViewer.viewer.scrollPageIntoView({
      pageNumber: pageNumber,
    });

    if (speechSynthesisRef.current.speaking) {
      speechSynthesisRef.current.cancel();
    }

    const content = await getPdfContentByPage(pageNumber);

    // happens if the given page has no content
    if (!content) {
      setCurrentPosition(0);
      readDocument(pageNumber + 1);
      setCurrentPageNumber(pageNumber + 1);
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

    utterance.rate = readingSpeed;
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
          setCurrentPageNumber(pageNumber + 1);
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
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.resume();
      setReadingStatus(READING_STATUS.READING);
    }
  };

  const handleChangeReadingSpeed = () => {
    const nextSpeed =
      (READING_SPEEDS.indexOf(readingSpeed) + 1) % READING_SPEEDS.length;
    const newSpeed = READING_SPEEDS[nextSpeed];

    if (!newSpeed) return;
    setReadingSpeed(newSpeed);

    if (utteranceRef.current && speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();

      if (readingStatus === READING_STATUS.READING) {
        readDocument(currentPageNumber, true);
      }
    }
  };

  return (
    <>
      <PdfLoader url={docUrl} beforeLoad={<SpinnerPage />}>
        {(pdfDocument) => (
          <PdfHighlighter
            pdfDocument={pdfDocument}
            ref={() => {
              // theres prob a better way to set this
              setPdf(pdfDocument);
            }}
            enableAreaSelection={(event) => event.altKey}
            onScrollChange={resetHash}
            // pdfScaleValue="page-width"
            scrollRef={(scrollTo) => {
              scrollViewerTo = scrollTo;
              scrollToHighlightFromHash(doc);
            }}
            onSelectionFinished={(
              position,
              content,
              hideTipAndSelection,
              transformSelection,
            ) => {
              return (
                <TextSelectionPopover
                  sendMessage={sendMessage}
                  content={content}
                  hideTipAndSelection={hideTipAndSelection}
                  position={position}
                  addHighlight={() => addHighlight({ content, position })}
                />
              );
            }}
            highlightTransform={(
              highlight,
              index,
              setTip,
              hideTip,
              viewportToScaled,
              screenshot,
              isScrolledTo,
            ) => {
              const isTextHighlight = highlight.position.rects?.length !== 0;

              const component = isTextHighlight ? (
                <div id={highlight.id}>
                  {/* @ts-ignore */}
                  <Highlight
                    isScrolledTo={isScrolledTo}
                    position={highlight.position}
                  />
                </div>
              ) : (
                <div id={highlight.id}>
                  <AreaHighlight
                    isScrolledTo={isScrolledTo}
                    highlight={highlight}
                    onChange={(boundingRect) => {
                      updateAreaHighlight({
                        id: highlight.id,
                        boundingRect: viewportToScaled(boundingRect),
                        type: HighlightTypeEnum.IMAGE,
                        documentId: docId,
                        ...(boundingRect.pageNumber
                          ? { pageNumber: boundingRect.pageNumber }
                          : {}),
                      });
                    }}
                  />
                </div>
              );

              return (
                <Popup
                  popupContent={
                    <HighlightedTextPopover
                      id={highlight.id}
                      deleteHighlight={deleteHighlight}
                      hideTip={hideTip}
                    />
                  }
                  onMouseOver={(popupContent) =>
                    setTip(highlight, (highlight) => popupContent)
                  }
                  onMouseOut={hideTip}
                  key={index}
                >
                  {component}
                </Popup>
              );
            }}
            // @ts-ignore
            highlights={highlights}
          />
        )}
      </PdfLoader>
      <ReaderBottomToolbar
        isAudioDisabled={!browserSupportsSpeechSynthesis}
        currentWord={
          readingStatus !== READING_STATUS.IDLE ? currentWord : undefined
        }
      >
        <div className="gap-1 relative z-50 flex items-center rounded-lg">
          {readingStatus === READING_STATUS.IDLE && (
            <Button
              onClick={() => readDocument(1)}
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
            {readingSpeed}x
          </Button>
        </div>
      </ReaderBottomToolbar>
    </>
  );
};

export default PdfReader;

import BottomToolbar from "@/components/pdf-reader/bottom-toolbar";
import {
  READING_MODE,
  READING_SPEEDS,
  READING_STATUS,
} from "@/components/pdf-reader/constants";
import PdfHighlighter from "@/components/pdf-reader/pdf-highlighter";
import { SpinnerPage } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { log } from "@/lib/utils";
import { AppRouter } from "@/server/api/root";
import { AddHighlightType } from "@/types/highlight";
import { inferRouterOutputs } from "@trpc/server";
import { type PDFViewer } from "pdfjs-dist/types/web/pdf_viewer";
import { useCallback, useEffect, useRef, useState } from "react";
import { PdfLoader } from "react-pdf-highlighter";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";

const HIGHLIGHT_TYPE_TO_CLASSNAME = {
  sentence: "current-sentence",
  word: "current-word",
};

const HIGHLIGHT_TYPE_TO_HTML_TAG = {
  sentence: "span",
  word: "div",
};

const processBlockContents = (blocks: string[]) => {
  const processedBlocks: string[] = [];

  let currentText = blocks.join("");

  const sentenceMatch = currentText.match(/[^.!?]+[.!?]+/g);
  if (!sentenceMatch) return processedBlocks;

  sentenceMatch.forEach((sentence) => {
    processedBlocks.push(sentence);
  });

  return processedBlocks;
};

const removeHighlightsByType = (type: "sentence" | "word") => {
  const className = HIGHLIGHT_TYPE_TO_CLASSNAME[type];
  const highlightedElements = document.querySelectorAll(`.${className}`);

  highlightedElements.forEach((element) => {
    const text = element?.textContent;

    if (element?.parentNode) {
      const newTextNode = document.createTextNode(text || "");
      element.parentNode.replaceChild(newTextNode, element);
    }
  });
};

const removeReadingHighlights = () => {
  removeHighlightsByType("sentence");
  removeHighlightsByType("word");
};

const getUpdatedTextForContinuedReading = (
  selectedText: string,
  blockXIndex: number,
) => {
  // this code is cause even if the current word is half read, it should start from the beginning of the word
  const previousWordLength =
    selectedText.substring(0, blockXIndex).split(/\s+/).pop()?.length || 0;
  const startIndex = Math.max(0, blockXIndex - previousWordLength);
  return selectedText.substring(startIndex);
};

type TIndexes = { x: number; y: number };

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
  const [currentReadingSpeed, setCurrentReadingSpeed] = useState(10);
  // const [currentReadingSpeed, setCurrentReadingSpeed] = useState(1);
  const [pageNumberInView, setPageNumberInView] = useState<number>(0);

  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const blockIndex = useRef<TIndexes>({ x: 1, y: 0 });
  const sentenceIndex = useRef<TIndexes>({ x: 0, y: 0 });

  const blocksLengths = useRef<number[]>([]);
  const blocksRef = useRef<Element[]>([]);

  const nonProcessedBlockContents = useRef<string[]>([]);

  const currentReadingMode = useRef<READING_MODE>(READING_MODE.PAGE);
  const currentPageRead = useRef(1);
  const pdfViewer = useRef<PDFViewer | null>(null);

  // only for text reading mode
  const selectedTextToRead = useRef("");

  const { mutateAsync } = api.document.updateLastReadPage.useMutation();

  const debouncedUpdateLastReadPage = useDebouncedCallback(
    async (pageNumber: number) => {
      await mutateAsync({ docId: doc.id, lastReadPage: pageNumber });
    },
    2000,
  );

  const initPdfViewer = useCallback(() => {
    const pdfViewerDocument = window.PdfViewer?.viewer;

    if (pdfViewerDocument) {
      pdfViewer.current = pdfViewerDocument;
      setPageNumberInView(pdfViewerDocument.currentPageNumber);

      // @ts-ignore
      const handlePageChanging = (e: PdfViewerEvent) => {
        const pageNumber = e.pageNumber;
        if (pageNumber !== pageNumberInView) {
          setPageNumberInView(pageNumber);
          debouncedUpdateLastReadPage(pageNumber);
        }
      };

      const handlePagesLoaded = () => {
        if (
          doc.lastReadPage &&
          pdfViewerDocument.currentPageNumber !== doc.lastReadPage
        ) {
          pdfViewerDocument.currentPageNumber = doc.lastReadPage;
        }
      };

      pdfViewerDocument.eventBus.on("pagechanging", handlePageChanging);
      pdfViewerDocument.eventBus.on("pagesloaded", handlePagesLoaded);
    }
  }, [debouncedUpdateLastReadPage, doc.lastReadPage, pageNumberInView]);

  useEffect(() => {
    speechSynthesisRef.current = window.speechSynthesis;

    return () => {
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    initPdfViewer();

    // Set up an interval to check periodically until pdfViewer is available
    const intervalId = setInterval(() => {
      if (window.PdfViewer?.viewer) {
        initPdfViewer();
        clearInterval(intervalId);
      }
      // TODO: tweak this value and see which works best
    }, 100);

    return () => {
      clearInterval(intervalId);
      window.PdfViewer?.viewer?.eventBus.off("pagechanging", () => {});
      window.PdfViewer?.viewer?.eventBus.off("pagesloaded", () => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const highlightInsideSameBlockByIndexes = ({
    startIndex,
    endIndex,
    type,
    blockYIndex,
    removePreviousHighlights = true,
  }: {
    startIndex: number;
    endIndex: number;
    type: "sentence" | "word";
    blockYIndex: number;
    removePreviousHighlights?: boolean; // false if its multi-sentence highlight - maybe support multi-line words in future.
  }) => {
    const currentBlockText =
      nonProcessedBlockContents.current[blockYIndex] ?? "";

    if (currentBlockText[startIndex] === " ") {
      startIndex += 1;
      if (
        endIndex < currentBlockText.length &&
        currentBlockText[endIndex] !== " "
      ) {
        endIndex += 1;
      }
    }

    const className = HIGHLIGHT_TYPE_TO_CLASSNAME[type];

    // this should only for the highlights that comes under current-sentence
    if (removePreviousHighlights) {
      removeHighlightsByType(type);
    }

    let block = blocksRef.current?.[blockYIndex];

    if (!block) {
      log("ERROR:::Block not found");
      return;
    }

    // trynna find the span wrapping current-word.
    if (type === "word") {
      block = block.querySelector(`.current-sentence`) ?? block;
      if (!block) {
        log("ERROR:::no current-sentence parent found !!!!");
        return;
      }
    }

    const text =
      type === "sentence"
        ? nonProcessedBlockContents.current[blockYIndex]
        : block.textContent;

    if (!text) {
      log("ERROR:::Text not found in block");
      return;
    }

    if (startIndex < 0 || startIndex > endIndex) {
      log("ERROR:::Invalid start or end indices", {
        startIndex,
        endIndex,
      });

      return;
    }

    if (endIndex > currentBlockText.length) {
      log("end-index > block-length", {
        "end-index": endIndex,
        text: nonProcessedBlockContents.current[blockYIndex],
        textLen: nonProcessedBlockContents.current[blockYIndex]?.length,
        type,
        "text-length": text.length,
      });
      endIndex = currentBlockText.length;
    }

    const lengthDif = currentBlockText.indexOf(text); // this wont work at all times.

    const ele = HIGHLIGHT_TYPE_TO_HTML_TAG[type];
    let highlightedText = "";
    let newHtml = "";
    let tex = "";

    if (type === "word") {
      tex = block.innerHTML;

      highlightedText = `<${ele} class="${className}">${currentBlockText.substring(
        startIndex,
        endIndex,
      )}</${ele}>`;

      newHtml =
        tex.substring(0, startIndex - lengthDif) +
        highlightedText +
        tex.substring(endIndex - lengthDif);
    } else {
      highlightedText = `<${ele} class="${className}">${currentBlockText.substring(
        startIndex,
        endIndex,
      )}</${ele}>`;

      newHtml =
        currentBlockText.substring(lengthDif, startIndex) +
        highlightedText +
        currentBlockText.substring(endIndex);
    }

    block.innerHTML = newHtml;
  };

  const readSelectedText = async ({
    text,
    readingSpeed,
    readingMode,
    highlightInsideSameBlockByIndexes,
  }: {
    text?: string | null;
    readingSpeed?: number;
    readingMode: READING_MODE;

    highlightInsideSameBlockByIndexes?: ({
      startIndex,
      endIndex,
      type,
      blockYIndex,
      removePreviousHighlights,
    }: {
      startIndex: number;
      endIndex: number;
      type: "sentence" | "word";
      blockYIndex: number;
      removePreviousHighlights?: boolean;
    }) => void;
  }) => {
    if (!speechSynthesisRef.current) return;

    currentReadingMode.current = readingMode;
    const isTextReadingMode = readingMode === READING_MODE.TEXT;
    // const continueReadingFromLastPosition = blockIndex.current.x !== 1 || blockIndex.current.y !== 0; // todo
    const continueReadingFromLastPosition = false; // todo
    const selectedText = text ?? window.getSelection()?.toString();

    if (!selectedText) return;

    if (isTextReadingMode && !continueReadingFromLastPosition) {
      selectedTextToRead.current = selectedText;
    }

    const textToRead = continueReadingFromLastPosition
      ? getUpdatedTextForContinuedReading(selectedText, blockIndex.current.x)
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
    speechSynthesisRef.current?.speak(utterance);

    await new Promise<void>((resolve) => {
      // utterance.onstart = (event) => {
      //   log(event.utterance.text, "current sentence");
      // };

      utterance.onboundary = (event) => {
        if (event.name === "word") {
          highlightInsideSameBlockByIndexes &&
            highlightInsideSameBlockByIndexes({
              startIndex: blockIndex.current.x,
              endIndex: blockIndex.current.x + event.charLength,
              type: "word",
              blockYIndex: blockIndex.current.y,
            });

          const currentWord = nonProcessedBlockContents.current[
            blockIndex.current.y
          ]?.substring(
            blockIndex.current.x,
            blockIndex.current.x + event.charLength,
          );

          const requiredWord = selectedText.substring(
            event.charIndex,
            event.charIndex + event.charLength,
          );

          const EQUAL = currentWord === requiredWord;
          if (!EQUAL) {
            log("NOT EQUAL", {
              "block-y": blockIndex.current.y,
              "block-x": blockIndex.current.x,
              "current-word": currentWord,
              "char-length": event.charLength,
              "required-word": requiredWord,
              "sentence-x": sentenceIndex.current.x,
              "block-length": blocksLengths.current[blockIndex.current.y],
            });
          }

          const newPosition = event.charIndex + event.charLength + lengthDiff;
          blockIndex.current.x += newPosition - sentenceIndex.current.x;

          sentenceIndex.current.x = newPosition;

          while (
            (blockIndex.current.y < blocksLengths.current.length &&
              blockIndex.current.x >=
                (blocksLengths.current[blockIndex.current.y] ?? 0)) ||
            // work around for adding space at the end of each line.
            (blockIndex.current.x ===
              (blocksLengths.current[blockIndex.current.y] ?? 0) - 1 &&
              currentWord === " ")
          ) {
            blockIndex.current.x -=
              blocksLengths.current[blockIndex.current.y] ?? 0;

            blockIndex.current.y += 1;
          }
        }
      };

      utterance.onend = (event) => {
        sentenceIndex.current.x = 0;
        setReadingStatus(READING_STATUS.IDLE);
        resolve();
      };
    });
  };

  const startSentenceBySentenceHighlighting = async (
    isContinueReading: boolean,
  ) => {
    try {
      setReadingStatus(READING_STATUS.READING);
      let startingPageNumber = isContinueReading
        ? currentPageRead.current
        : pageNumberInView;

      // initially the pagenumber is set as 0, and it changes when "load" event or "pagechanging" event fires, incase that doesnt happen, we set it to 1
      startingPageNumber = startingPageNumber > 0 ? startingPageNumber : 1;

      for (let pageNum = startingPageNumber; pageNum <= pageCount; pageNum++) {
        currentPageRead.current = pageNum;

        pdfViewer.current?.scrollPageIntoView({
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
        blocksRef.current = blocks;

        const blockContents = blocks
          .map((block) => block.textContent ?? "")
          .map((block) => {
            if (block.trim().length === 0) {
              return "";
            } else if (block.endsWith(" ")) {
              return block;
            }
            return `${block} `;
          });

        nonProcessedBlockContents.current = blockContents;
        blocksLengths.current = blockContents.map((block) => block.length);

        const processedBlocks = processBlockContents(blockContents);

        for (let i = sentenceIndex.current.y; i < processedBlocks.length; i++) {
          sentenceIndex.current.y = i;

          const sentence = processedBlocks[i];

          if (!sentence) {
            log("ERROR:::Sentence not found");
            continue;
          }

          const addClassAroundSentence = (
            blockYIndex: number,
            sentenceLength: number,
            blockXIndex: number,
            removePreviousHighlights: boolean = true,
          ) => {
            if (
              sentenceLength <= 0 ||
              isNaN(sentenceLength) ||
              blockXIndex < 0 ||
              isNaN(blockXIndex) ||
              blockYIndex < 0 ||
              isNaN(blockYIndex)
            ) {
              log("ERROR:::Invalid sentence length or block index", {
                blockYIndex,
                sentenceLength,
                blockXIndex,
              });
              return;
            }

            const blockLength = blocksLengths.current[blockYIndex] ?? 0;

            if (blockLength - blockXIndex >= sentenceLength) {
              highlightInsideSameBlockByIndexes({
                startIndex: blockXIndex,
                endIndex: blockXIndex + sentenceLength,
                type: "sentence",
                blockYIndex,
                removePreviousHighlights,
              });
            } else {
              // const text =
              //   blocks[blockYIndex]?.textContent?.slice(
              //     blockXIndex,
              //     blockLength,
              //   ) ?? "";

              highlightInsideSameBlockByIndexes({
                startIndex: blockXIndex,
                endIndex: blockLength,
                type: "sentence",
                blockYIndex,
                removePreviousHighlights,
              });

              sentenceLength -= blockLength - blockXIndex;
              if (sentenceLength <= 0) return;
              addClassAroundSentence(blockYIndex + 1, sentenceLength, 0, false);
            }
          };

          addClassAroundSentence(
            blockIndex.current.y,
            sentence.length,
            blockIndex.current.x,
            true,
          );

          await readSelectedText({
            text: sentence,
            highlightInsideSameBlockByIndexes,
            readingMode: READING_MODE.PAGE,
          });

          removeReadingHighlights();
          sentenceIndex.current.x = 0;
        }

        sentenceIndex.current.y = 0;
        blockIndex.current.x = 1;
        blockIndex.current.y = 0;
      }
    } catch (err: any) {
      console.error("PDF Reader error:", err.message);
      toast.error("An error occurred while reading the document");

      stopReading();
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

    blockIndex.current.x = 1;
    blockIndex.current.y = 0;

    sentenceIndex.current.x = 0;
    sentenceIndex.current.y = 0;

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
          startSentenceBySentenceHighlighting(true);
        }
      } else {
        speechSynthesisRef.current?.resume();
      }
    }
  };

  const debouncedStartSentenceBySentenceHighlighting = useDebouncedCallback(
    startSentenceBySentenceHighlighting,
    500,
  );

  const debouncedReadSelectedText = useDebouncedCallback(readSelectedText, 500);

  const handleReadingSpeedChange = async () => {
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
          await debouncedStartSentenceBySentenceHighlighting(true);
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
      <BottomToolbar
        canEdit={doc.userPermissions.canEdit}
        isOwner={doc.userPermissions.isOwner}
        isVectorised={doc.isVectorised}
        pageNumberInView={pageNumberInView}
        currentReadingSpeed={currentReadingSpeed}
        readingStatus={readingStatus}
        startWordByWordHighlighting={startSentenceBySentenceHighlighting}
        handleReadingSpeedChange={handleReadingSpeedChange}
        resumeReading={resumeReading}
        stopReading={stopReading}
        pauseReading={pauseReading}
        note={doc.note}
      />
    </>
  );
};

export default PdfReader;

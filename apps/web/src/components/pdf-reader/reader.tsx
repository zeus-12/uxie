import BottomToolbar from "@/components/pdf-reader/toolbar";
import { api } from "@/lib/api";
import {
  type AddHighlightType,
  type HighlightPositionType,
} from "@/types/highlight";
import { type ReaderDoc } from "@/types/reader";
import { HighlightTypeEnum } from "@prisma/client";
import PdfHighlighter from "@uxie/shared/components/pdf-reader/pdf-highlighter";
import { PdfLoader } from "@uxie/shared/components/pdf-reader/pdf-loader";
import { SpinnerPage } from "@uxie/shared/components/ui/spinner";
import usePdfReader from "@uxie/shared/hooks/use-pdf-reader";
import { type PDFDocumentProxy } from "pdfjs-dist";
import { type PDFViewer } from "pdfjs-dist/types/web/pdf_viewer";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

const PdfReader = ({
  addHighlight,
  deleteHighlight,
  doc,
  onPdfDocumentChange,
  onUpdateReaderState,
  onUpdateAreaHighlight,
}: {
  addHighlight: ({ content, position }: AddHighlightType) => Promise<void>;
  deleteHighlight: (id: string) => void;
  doc: ReaderDoc;
  onPdfDocumentChange?: (pdfDocument: PDFDocumentProxy | null) => void;
  // When provided (e.g. the local demo), these bypass the backend for the two
  // persistence touchpoints; otherwise the components fall back to tRPC.
  onUpdateReaderState?: (
    docId: string,
    state: { lastReadPage?: number; zoomLevel?: number },
  ) => void;
  onUpdateAreaHighlight?: (
    id: string,
    boundingRect: HighlightPositionType["boundingRect"],
    pageNumber?: number,
  ) => void;
}) => {
  const { url: docUrl, pageCount, id: docId, lastReadPage, zoomLevel } = doc;

  const [pdfViewer, setPdfViewer] = useState<PDFViewer | null>(null);
  const [reflowed, setReflowed] = useState(false);
  const handleHighlighterRef = useCallback(
    (instance: { viewer: PDFViewer } | null) => {
      setPdfViewer(instance?.viewer ?? null);
    },
    [],
  );

  // Persistence lives here, not in the shared components: they only report what
  // happened. The demo injects its own local writers instead.
  const utils = api.useContext();
  const { mutateAsync: saveReaderState } =
    api.document.updateReaderState.useMutation();

  const { mutate: persistAreaHighlight } =
    api.highlight.updateAreaHighlight.useMutation({
      async onMutate(newHighlight) {
        await utils.document.getDocData.cancel();
        const prevData = utils.document.getDocData.getData();

        utils.document.getDocData.setData({ docId }, (old) => {
          if (!old || old.kind !== "pdf") return old;
          return {
            ...old,
            highlights: old.highlights.map((h) =>
              h.id === newHighlight.id
                ? {
                    ...h,
                    position: {
                      ...h.position,
                      boundingRect: {
                        ...h.position.boundingRect,
                        ...newHighlight.boundingRect,
                      },
                      pageNumber: newHighlight.pageNumber ?? null,
                      rects: [],
                    },
                  }
                : h,
            ),
          };
        });

        return { prevData };
      },
      onError(err, newPost, ctx) {
        toast.error("Something went wrong", { duration: 3000 });
        utils.document.getDocData.setData({ docId }, ctx?.prevData);
      },
      onSettled() {
        void utils.document.getDocData.invalidate();
      },
    });

  const highlights = useMemo(() => doc.highlights ?? [], [doc.highlights]);

  const {
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
  } = usePdfReader({
    docId,
    lastReadPage,
    zoomLevel,
    pageCount,
    viewer: pdfViewer,
    reflowed,
    onSaveReaderState: (state) => {
      if (onUpdateReaderState) {
        onUpdateReaderState(docId, state);
        return;
      }
      void saveReaderState({ docId, ...state });
    },
  });

  return (
    <>
      <PdfLoader url={docUrl} beforeLoad={<SpinnerPage />}>
        {(pdfDocument) => (
          <LoadedPdfHighlighter
            onPdfDocumentChange={onPdfDocumentChange}
            pdfDocument={pdfDocument}
          >
            <PdfHighlighter
              highlighterRef={handleHighlighterRef}
              pdfDocument={pdfDocument}
              highlights={highlights}
              showAiFeatures={doc.isVectorised}
              addHighlight={({ content, position }) =>
                void addHighlight({
                  content,
                  position: position as AddHighlightType["position"],
                })
              }
              deleteHighlight={deleteHighlight}
              updateAreaHighlight={(id, boundingRect, pageNumber) => {
                if (onUpdateAreaHighlight) {
                  onUpdateAreaHighlight(
                    id,
                    boundingRect as HighlightPositionType["boundingRect"],
                    pageNumber,
                  );
                  return;
                }
                persistAreaHighlight({
                  id,
                  boundingRect:
                    boundingRect as HighlightPositionType["boundingRect"],
                  type: HighlightTypeEnum.IMAGE,
                  documentId: docId,
                  ...(pageNumber ? { pageNumber } : {}),
                });
              }}
              readSelectedText={readSelectedText}
              pdfScaleValue={pdfScaleValue}
              onZoomChange={handleZoomChange}
              onReflowChange={setReflowed}
            />
          </LoadedPdfHighlighter>
        )}
      </PdfLoader>
      <BottomToolbar
        pageNumberInView={pageNumberInView}
        currentReadingSpeed={currentReadingSpeed}
        readingStatus={readingStatus}
        startWordByWordHighlighting={startSentenceBySentenceHighlighting}
        handleReadingSpeedChange={handleReadingSpeedChange}
        resumeReading={resumeReading}
        stopReading={stopReading}
        pauseReading={pauseReading}
        skipSentence={skipSentence}
        skipToPreviousSentence={skipToPreviousSentence}
        totalPages={pageCount}
        onZoomChange={handleToolbarZoomChange}
        onPageChange={handlePageChange}
        currentZoom={currentZoom}
        reflowed={reflowed}
        pageColour={pageColour}
        pageColourChangeHandler={pageColourChangeHandler}
        followAlongEnabled={followAlongEnabled}
        toggleFollowAlong={toggleFollowAlong}
      />
    </>
  );
};

const LoadedPdfHighlighter = ({
  children,
  onPdfDocumentChange,
  pdfDocument,
}: {
  children: ReactNode;
  onPdfDocumentChange?: (pdfDocument: PDFDocumentProxy | null) => void;
  pdfDocument: PDFDocumentProxy;
}) => {
  useEffect(() => {
    onPdfDocumentChange?.(pdfDocument);
    return () => onPdfDocumentChange?.(null);
  }, [onPdfDocumentChange, pdfDocument]);

  return children;
};

export default PdfReader;

import BottomToolbar from "@/components/pdf-reader/toolbar";
import PdfHighlighter from "@uxie/shared/components/pdf-reader/pdf-highlighter";
import { SpinnerPage } from "@uxie/shared/components/ui/spinner";
import { api } from "@/lib/api";
import usePdfReader from "@uxie/shared/hooks/use-pdf-reader";
import {
  type AddHighlightType,
  type HighlightPositionType,
} from "@/types/highlight";
import { type ReaderDoc } from "@/types/reader";
import { HighlightTypeEnum } from "@prisma/client";
import { type PDFViewer } from "pdfjs-dist/types/web/pdf_viewer";
import { useCallback, useMemo, useState } from "react";
import { PdfLoader } from "react-pdf-highlighter";
import { toast } from "sonner";

const PdfReader = ({
  addHighlight,
  deleteHighlight,
  doc,
  onUpdateLastReadPage,
  onUpdateAreaHighlight,
}: {
  addHighlight: ({ content, position }: AddHighlightType) => Promise<void>;
  deleteHighlight: (id: string) => void;
  doc: ReaderDoc;
  // When provided (e.g. the local demo), these bypass the backend for the two
  // persistence touchpoints; otherwise the components fall back to tRPC.
  onUpdateLastReadPage?: (docId: string, pageNumber: number) => void;
  onUpdateAreaHighlight?: (
    id: string,
    boundingRect: HighlightPositionType["boundingRect"],
    pageNumber?: number,
  ) => void;
}) => {
  const { url: docUrl, pageCount, id: docId, lastReadPage } = doc;

  // PdfHighlighter owns the pdf.js PDFViewer. Capture it here (stable callback
  // ref, so it only fires on mount/unmount) and hand it to usePdfReader, which
  // needs the live instance to track the page in view and apply zoom.
  const [pdfViewer, setPdfViewer] = useState<PDFViewer | null>(null);
  const handleHighlighterRef = useCallback(
    (instance: { viewer: PDFViewer } | null) => {
      setPdfViewer(instance?.viewer ?? null);
    },
    [],
  );

  // Persistence lives here, not in the shared components: they only report what
  // happened. The demo injects its own local writers instead.
  const utils = api.useContext();
  const { mutateAsync: saveLastReadPage } =
    api.document.updateLastReadPage.useMutation();

  const { mutate: persistAreaHighlight } =
    api.highlight.updateAreaHighlight.useMutation({
      async onMutate(newHighlight) {
        await utils.document.getDocData.cancel();
        const prevData = utils.document.getDocData.getData();

        utils.document.getDocData.setData({ docId }, (old) => {
          if (!old) return old;
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
    handleZoomChange,
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
    pageCount,
    viewer: pdfViewer,
    onSaveLastReadPage: (pageNumber) => {
      if (onUpdateLastReadPage) {
        onUpdateLastReadPage(docId, pageNumber);
        return;
      }
      void saveLastReadPage({ docId, lastReadPage: pageNumber });
    },
  });

  return (
    <>
      <PdfLoader url={docUrl} beforeLoad={<SpinnerPage />}>
        {(pdfDocument) => (
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
                boundingRect: boundingRect as HighlightPositionType["boundingRect"],
                type: HighlightTypeEnum.IMAGE,
                documentId: docId,
                ...(pageNumber ? { pageNumber } : {}),
              });
            }}
            readSelectedText={readSelectedText}
            pdfScaleValue={pdfScaleValue}
          />
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
        totalPages={pageCount}
        onZoomChange={handleZoomChange}
        onPageChange={handlePageChange}
        currentZoom={currentZoom}
        pageColour={pageColour}
        pageColourChangeHandler={pageColourChangeHandler}
        followAlongEnabled={followAlongEnabled}
        toggleFollowAlong={toggleFollowAlong}
      />
    </>
  );
};

export default PdfReader;

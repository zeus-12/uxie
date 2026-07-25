import PdfHighlighter from "@/components/pdf-reader/pdf-highlighter";
import BottomToolbar from "@/components/pdf-reader/toolbar";
import { SpinnerPage } from "@/components/ui/spinner";
import usePdfReader from "@/hooks/use-pdf-reader";
import {
  type AddHighlightType,
  type HighlightPositionType,
} from "@/types/highlight";
import { type ReaderDoc } from "@/types/reader";
import { type PDFViewer } from "pdfjs-dist/types/web/pdf_viewer";
import { useCallback, useState } from "react";
import { PdfLoader } from "react-pdf-highlighter";

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
    onUpdateLastReadPage,
  });

  return (
    <>
      <PdfLoader url={docUrl} beforeLoad={<SpinnerPage />}>
        {(pdfDocument) => (
          <PdfHighlighter
            highlighterRef={handleHighlighterRef}
            pdfDocument={pdfDocument}
            doc={doc}
            addHighlight={addHighlight}
            deleteHighlight={deleteHighlight}
            readSelectedText={readSelectedText}
            onUpdateAreaHighlight={onUpdateAreaHighlight}
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

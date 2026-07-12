import PdfHighlighter from "@/components/pdf-reader/pdf-highlighter";
import BottomToolbar from "@/components/pdf-reader/toolbar";
import { SpinnerPage } from "@/components/ui/spinner";
import usePdfReader from "@/hooks/use-pdf-reader";
import { type AppRouter } from "@/server/api/root";
import { type AddHighlightType } from "@/types/highlight";
import { type inferRouterOutputs } from "@trpc/server";
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
  const { url: docUrl, pageCount, id: docId, lastReadPage } = doc;

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
    pageColour,
    pageColourChangeHandler,
    followAlongEnabled,
    toggleFollowAlong,
  } = usePdfReader({
    docId,
    lastReadPage,
    pageCount,
  });

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

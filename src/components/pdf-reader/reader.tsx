import PdfHighlighter from "@/components/pdf-reader/pdf-highlighter";
import BottomToolbar from "@/components/pdf-reader/toolbar";
import { SpinnerPage } from "@/components/ui/spinner";
import usePdfReader from "@/hooks/use-pdf-reader";
import { AppRouter } from "@/server/api/root";
import { AddHighlightType } from "@/types/highlight";
import { inferRouterOutputs } from "@trpc/server";
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
    handleZoomChange,
    handlePageChange,
    readSelectedText,
    currentZoom,
    pageColour,
    pageColourChangeHandler,
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
        totalPages={pageCount}
        onZoomChange={handleZoomChange}
        onPageChange={handlePageChange}
        currentZoom={currentZoom}
        pageColour={pageColour}
        pageColourChangeHandler={pageColourChangeHandler}
      />
    </>
  );
};

export default PdfReader;

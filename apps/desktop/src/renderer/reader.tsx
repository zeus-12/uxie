import { useCallback, useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { ArrowLeftIcon, SettingsIcon } from "lucide-react";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.js?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  PdfLoader,
  type IHighlight,
  type ScaledPosition,
} from "react-pdf-highlighter";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@uxie/shared/components/ui/resizable";
import {
  Sidebar,
  SidebarHeader,
} from "@uxie/shared/components/workspace/sidebar";
import {
  useBlocknoteEditorStore,
  useChatStore,
  useSidebarTabStore,
} from "@uxie/shared/lib/store";
import { Spinner, SpinnerPage } from "@uxie/shared/components/ui/spinner";
import BottomToolbar from "@uxie/shared/components/pdf-reader/toolbar";
import PdfHighlighter, {
  type HighlighterInstance,
} from "@uxie/shared/components/pdf-reader/pdf-highlighter";
import usePdfReader from "@uxie/shared/hooks/use-pdf-reader";
import type {
  Cordinate,
  DocumentWithHighlights,
  HighlightWithRects,
  RectInput,
} from "@uxie/shared/schema";
import { Chat } from "./chat";
import { Notes } from "./notes";
import { FlashcardsPanel } from "./flashcards";

type PdfViewerInstance = HighlighterInstance["viewer"];

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

const scaled = (c: Cordinate | RectInput) => ({
  x1: c.x1,
  y1: c.y1,
  x2: c.x2,
  y2: c.y2,
  width: c.width,
  height: c.height,
  pageNumber: c.pageNumber ?? undefined,
});

function toViewerHighlight(h: HighlightWithRects): IHighlight | null {
  if (!h.boundingRectangle) return null;
  const pageNumber = h.pageNumber ?? h.boundingRectangle.pageNumber ?? 1;
  return {
    id: h.id,
    position: {
      boundingRect: { ...scaled(h.boundingRectangle), pageNumber },
      rects: h.rectangles.map((r) => ({ ...scaled(r), pageNumber })),
      pageNumber,
    },
    content: {},
    comment: { text: "", emoji: "" },
  };
}

const toRectInput = (s: { pageNumber?: number } & RectInput): RectInput => ({
  x1: s.x1,
  y1: s.y1,
  x2: s.x2,
  y2: s.y2,
  width: s.width,
  height: s.height,
  pageNumber: s.pageNumber ?? null,
});

// Mirror the web: a text highlight also drops a linked "highlight" block into
// the notes editor (no-op if the notes tab hasn't mounted the editor yet).
function addHighlightToNotes(
  highlightId: string,
  text: string,
  pageNumber?: number,
) {
  const editor = useBlocknoteEditorStore.getState().editor as
    | {
        insertBlocks: (blocks: unknown[], ref: unknown) => void;
        document: unknown[];
      }
    | null;
  if (!editor) return;
  try {
    editor.insertBlocks(
      [
        {
          type: "highlight",
          content: text,
          props: { highlightId, ...(pageNumber ? { pageNumber } : {}) },
        },
      ],
      editor.document[editor.document.length - 1],
    );
  } catch {
    // block schema/insert edge cases shouldn't break highlighting
  }
}

export function Reader({
  id,
  onBack,
  onSettings,
}: {
  id: string;
  onBack: () => void;
  onSettings: () => void;
}) {
  const [doc, setDoc] = useState<DocumentWithHighlights | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.uxieAPI
      .getDocument(id)
      .then((d) => !cancelled && setDoc(d))
      .catch((e) => !cancelled && setError(message(e)));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (doc) {
    return (
      <div className="flex h-full flex-col bg-gray-50">
        <ReaderContent
          docId={id}
          doc={doc}
          onBack={onBack}
          onSettings={onSettings}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <header className="app-drag flex h-12 items-center gap-3 pl-24 pr-4">
        <button
          onClick={onBack}
          aria-label="Back to library"
          className="app-no-drag rounded-md p-1.5 text-muted-foreground hover:bg-gray-100 hover:text-foreground"
        >
          <ArrowLeftIcon size={18} />
        </button>
      </header>
      {error ? (
        <p className="p-6 text-sm text-destructive">{error}</p>
      ) : doc === undefined ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">Document not found.</p>
      )}
    </div>
  );
}

function ReaderContent({
  docId,
  doc,
  onBack,
  onSettings,
}: {
  docId: string;
  doc: DocumentWithHighlights;
  onBack: () => void;
  onSettings: () => void;
}) {
  const [highlights, setHighlights] = useState<IHighlight[]>(() =>
    doc.highlights
      .map(toViewerHighlight)
      .filter((h): h is IHighlight => h !== null),
  );
  const [error, setError] = useState<string | null>(null);

  // PdfHighlighter owns the pdf.js PDFViewer. Capture it here (stable callback
  // ref, so it only fires on mount/unmount) and hand it to usePdfReader, which
  // needs the live instance to track the page in view and apply zoom. The ref
  // mirrors it for callbacks that shouldn't re-subscribe when it arrives.
  const [pdfViewer, setPdfViewer] = useState<PdfViewerInstance | null>(null);
  const handleHighlighterRef = useCallback(
    (instance: HighlighterInstance | null) => {
      setPdfViewer(instance?.viewer ?? null);
    },
    [],
  );

  const setSidebarTab = useSidebarTabStore((s) => s.setTab);

  // ⌘1/2/3 switch tabs; ⌘L jumps to chat and focuses its input. Kept out of the
  // UI — just shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const focusChat = () =>
        setTimeout(() => useChatStore.getState().focusInput?.(), 0);
      if (e.key === "1") {
        e.preventDefault();
        setSidebarTab("notes");
      } else if (e.key === "2") {
        e.preventDefault();
        setSidebarTab("chat");
      } else if (e.key === "3") {
        e.preventDefault();
        setSidebarTab("flashcards");
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        setSidebarTab("chat");
        focusChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSidebarTab]);

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
    lastReadPage: doc.lastReadPage,
    pageCount: doc.pageCount,
    viewer: pdfViewer,
    onSaveLastReadPage: (page) => {
      void window.uxieAPI.updateLastReadPage(docId, page);
    },
  });

  async function addHighlight(
    position: ScaledPosition,
    content: { text?: string; image?: string },
  ) {
    const hlId = createId();
    const isText = !content.image;
    setHighlights((prev) => [
      ...prev,
      { id: hlId, position, content, comment: { text: "", emoji: "" } },
    ]);
    if (isText && content.text)
      addHighlightToNotes(hlId, content.text, position.pageNumber);
    try {
      await window.uxieAPI.addHighlight({
        id: hlId,
        documentId: docId,
        type: isText ? "TEXT" : "IMAGE",
        pageNumber: position.pageNumber,
        boundingRect: toRectInput(position.boundingRect),
        rects: position.rects.map(toRectInput),
      });
    } catch (e) {
      setHighlights((prev) => prev.filter((h) => h.id !== hlId));
      setError(message(e));
    }
  }

  async function deleteHighlight(hlId: string) {
    const prev = highlights;
    setHighlights((hs) => hs.filter((h) => h.id !== hlId));
    try {
      await window.uxieAPI.deleteHighlight(hlId);
    } catch (e) {
      setHighlights(prev);
      setError(message(e));
    }
  }

  async function updateArea(
    hlId: string,
    boundingRect: ScaledPosition["boundingRect"],
  ) {
    const prev = highlights;
    setHighlights((hs) =>
      hs.map((h) =>
        h.id === hlId ? { ...h, position: { ...h.position, boundingRect } } : h,
      ),
    );
    try {
      await window.uxieAPI.updateAreaHighlight(hlId, toRectInput(boundingRect));
    } catch (e) {
      setHighlights(prev);
      setError(message(e));
    }
  }

  return (
    <ResizablePanelGroup
      autoSaveId="reader-layout"
      direction="horizontal"
      className="flex-1 overflow-hidden"
    >
      <ResizablePanel defaultSize={55} minSize={30}>
        <div className="flex h-full flex-col border-r border-stone-200">
          <div className="app-drag flex h-12 shrink-0 items-center gap-3 pl-24 pr-3">
            <button
              onClick={onBack}
              aria-label="Back to library"
              className="app-no-drag rounded-md p-1.5 text-muted-foreground transition-all duration-150 hover:bg-gray-100 hover:text-foreground active:scale-95"
            >
              <ArrowLeftIcon size={18} />
            </button>
            <span className="truncate text-sm font-medium text-muted-foreground">
              {doc.title}
            </span>
          </div>
          <div
            className="relative flex-1 overflow-hidden shadow-sm"
            style={{ background: pageColour }}
          >
            {error && (
            <p className="absolute left-2 top-2 z-50 rounded bg-red-50 px-2 py-1 text-xs text-destructive">
              {error}
            </p>
          )}
          <PdfLoader
            url={doc.url}
            workerSrc={workerSrc}
            beforeLoad={<SpinnerPage />}
          >
            {(pdfDocument: PDFDocumentProxy) => (
              <PdfHighlighter
                highlighterRef={handleHighlighterRef}
                pdfDocument={pdfDocument}
                pdfScaleValue={pdfScaleValue}
                highlights={highlights}
                showAiFeatures={doc.isVectorised}
                addHighlight={({ content, position }) =>
                  void addHighlight(position as ScaledPosition, content)
                }
                deleteHighlight={(hid) => void deleteHighlight(hid)}
                updateAreaHighlight={(hid, boundingRect) =>
                  void updateArea(
                    hid,
                    boundingRect as ScaledPosition["boundingRect"],
                  )
                }
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
            totalPages={doc.pageCount}
            onZoomChange={handleZoomChange}
            onPageChange={handlePageChange}
            currentZoom={currentZoom}
            pageColour={pageColour}
            pageColourChangeHandler={pageColourChangeHandler}
            followAlongEnabled={followAlongEnabled}
            toggleFollowAlong={toggleFollowAlong}
          />
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle className="relative w-2 border-0 bg-gray-50 after:absolute after:left-1/2 after:top-1/2 after:h-16 after:w-1 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-neutral-400 after:transition-colors hover:after:bg-primary" />
      <ResizablePanel defaultSize={45} minSize={25}>
        <div className="flex h-full flex-col">
          <SidebarHeader className="app-drag" tabsClassName="app-no-drag">
            <button
              onClick={onSettings}
              aria-label="Settings"
              className="app-no-drag ml-auto rounded-md p-1.5 text-muted-foreground transition-all duration-150 hover:bg-gray-100 hover:text-foreground active:scale-90"
            >
              <SettingsIcon
                size={18}
                className="transition-transform duration-300 hover:rotate-45"
              />
            </button>
          </SidebarHeader>
          <div className="min-h-0 flex-1">
            <Sidebar
              notes={<Notes docId={docId} note={doc.note} />}
              chat={<Chat docId={docId} isVectorised={doc.isVectorised} />}
              flashcards={<FlashcardsPanel docId={docId} />}
              defaultTab="notes"
            />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

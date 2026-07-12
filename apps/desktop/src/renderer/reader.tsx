import { useEffect, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.js?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  AreaHighlight,
  Highlight,
  PdfHighlighter,
  PdfLoader,
  Popup,
  type IHighlight,
  type ScaledPosition,
} from "react-pdf-highlighter";
import type {
  Cordinate,
  DocumentWithHighlights,
  HighlightWithRects,
  RectInput,
} from "@uxie/shared/schema";

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
  const pageNumber =
    h.pageNumber ?? h.boundingRectangle.pageNumber ?? 1;
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
  const [highlights, setHighlights] = useState<IHighlight[]>([]);

  useEffect(() => {
    let cancelled = false;
    window.uxieAPI
      .getDocument(id)
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        if (d) {
          setHighlights(
            d.highlights
              .map(toViewerHighlight)
              .filter((h): h is IHighlight => h !== null),
          );
        }
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

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
    try {
      await window.uxieAPI.addHighlight({
        id: hlId,
        documentId: id,
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
        h.id === hlId
          ? { ...h, position: { ...h.position, boundingRect } }
          : h,
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
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="app-drag flex items-center gap-4 border-b border-zinc-200 py-3 pl-24 pr-6 dark:border-zinc-800">
        <button
          onClick={onBack}
          className="app-no-drag text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Library
        </button>
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {doc?.title ?? ""}
        </span>
        <div className="app-no-drag ml-auto flex items-center gap-4">
          <span className="text-xs text-zinc-400">
            Select text to highlight · Alt-drag for an area
          </span>
          <button
            onClick={onSettings}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Settings
          </button>
        </div>
      </header>

      {error ? (
        <p className="p-6 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : doc === undefined ? (
        <p className="p-6 text-sm text-zinc-500">Loading…</p>
      ) : doc === null ? (
        <p className="p-6 text-sm text-zinc-500">Document not found.</p>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <PdfLoader
            url={doc.url}
            workerSrc={workerSrc}
            beforeLoad={<p className="p-6 text-sm text-zinc-500">Loading PDF…</p>}
          >
            {(pdfDocument: PDFDocumentProxy) => (
              <PdfHighlighter
                pdfDocument={pdfDocument}
                enableAreaSelection={(e) => e.altKey}
                onScrollChange={() => {}}
                scrollRef={() => {}}
                onSelectionFinished={(
                  position,
                  content,
                  hideTipAndSelection,
                ) => (
                  <button
                    className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow dark:bg-white dark:text-zinc-900"
                    onClick={() => {
                      void addHighlight(position, content);
                      hideTipAndSelection();
                    }}
                  >
                    Highlight
                  </button>
                )}
                highlightTransform={(
                  highlight,
                  index,
                  setTip,
                  hideTip,
                  viewportToScaled,
                  _screenshot,
                  isScrolledTo,
                ) => {
                  const isText = highlight.position.rects?.length !== 0;
                  const component = isText ? (
                    <Highlight
                      isScrolledTo={isScrolledTo}
                      position={highlight.position}
                      comment={highlight.comment}
                    />
                  ) : (
                    <AreaHighlight
                      isScrolledTo={isScrolledTo}
                      highlight={highlight}
                      onChange={(rect) =>
                        void updateArea(highlight.id, viewportToScaled(rect))
                      }
                    />
                  );
                  return (
                    <Popup
                      key={index}
                      onMouseOver={(popupContent) =>
                        setTip(highlight, () => popupContent)
                      }
                      onMouseOut={hideTip}
                      popupContent={
                        <button
                          className="rounded bg-white px-2 py-1 text-xs text-red-600 shadow"
                          onClick={() => void deleteHighlight(highlight.id)}
                        >
                          Delete
                        </button>
                      }
                    >
                      {component}
                    </Popup>
                  );
                }}
                highlights={highlights}
              />
            )}
          </PdfLoader>
        </div>
      )}
    </div>
  );
}

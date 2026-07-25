import {
  HighlightedTextPopover,
  TextSelectionPopover,
  type ReadSelectedText,
  type SelectionInfo,
} from "./highlight-popover";
import { getHighlightPageNumber } from "../../lib/highlights";
import {
  useChatStore,
  useHighlightJumpStore,
  usePdfSettingsStore,
} from "../../lib/store";
import { type PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useRef } from "react";
import {
  AreaHighlight,
  Highlight,
  type IHighlight,
  PdfHighlighter as PdfHighlighterComponent,
  Popup,
} from "react-pdf-highlighter";
import { toast } from "sonner";

type Rect = {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  pageNumber?: number | null;
};

/**
 * The geometry is treated opaquely — it goes straight to react-pdf-highlighter
 * — so this is loose enough for both web's DB-shaped highlights and desktop's
 * already-mapped ones.
 */
export type ReaderHighlight = {
  id: string;
  position: {
    boundingRect: Rect;
    rects: Rect[];
    pageNumber?: number | null;
  };
};

export type HighlighterInstance = InstanceType<typeof PdfHighlighterComponent>;

const PdfHighlighter = ({
  pdfDocument,
  highlights,
  pdfScaleValue,
  highlighterRef,
  addHighlight,
  deleteHighlight,
  updateAreaHighlight,
  readSelectedText,
  showAiFeatures,
}: {
  pdfDocument: PDFDocumentProxy;
  highlights: ReaderHighlight[];
  pdfScaleValue: string;
  // Hands the mounted PdfHighlighter instance (and so its pdf.js PDFViewer) to
  // the caller, which needs it to track the page in view and apply zoom.
  highlighterRef?: (instance: HighlighterInstance | null) => void;
  // Persistence is the caller's business: web writes through tRPC, desktop
  // through IPC, the demo into local state.
  addHighlight: (args: {
    content: { text?: string; image?: string };
    position: IHighlight["position"];
  }) => void;
  deleteHighlight: (id: string) => void;
  updateAreaHighlight: (
    id: string,
    boundingRect: Rect,
    pageNumber?: number,
  ) => void;
  readSelectedText: ReadSelectedText;
  // Whether the document is indexed — the AI actions are hidden until it is.
  showAiFeatures: boolean;
}) => {
  const sendMessage = useChatStore((state) => state.sendMessage);
  const linksDisabled = usePdfSettingsStore((state) => state.linksDisabled);

  const selectionInfoRef = useRef<SelectionInfo | null>(null);

  // Handed to us by the viewer once the document is ready.
  const scrollToHighlightRef = useRef<((highlight: IHighlight) => void) | null>(
    null,
  );
  const setJumpToHighlight = useHighlightJumpStore(
    (state) => state.setJumpToHighlight,
  );

  // Keep the mounted instance locally (for the jump fallback below) as well as
  // handing it to the caller.
  const highlighterInstanceRef = useRef<HighlighterInstance | null>(null);
  const setHighlighterRef = useCallback(
    (instance: HighlighterInstance | null) => {
      highlighterInstanceRef.current = instance;
      highlighterRef?.(instance);
    },
    [highlighterRef],
  );

  // The highlight blocks in the notes editor jump through here. It goes by page
  // number rather than by element id: pdf.js only keeps nearby pages rendered,
  // so a highlight's DOM node doesn't exist until its page is scrolled into view.
  useEffect(() => {
    setJumpToHighlight((highlightId, fallbackPageNumber) => {
      const highlight = highlights.find((h) => h.id === highlightId);
      const pageNumber = highlight
        ? getHighlightPageNumber(highlight.position)
        : fallbackPageNumber;

      if (!pageNumber) {
        toast.error("Couldn't find this highlight in the document", {
          duration: 3000,
        });
        return;
      }

      const scrollToHighlight = scrollToHighlightRef.current;
      if (highlight && scrollToHighlight) {
        scrollToHighlight({
          ...highlight,
          position: { ...highlight.position, pageNumber },
        } as unknown as IHighlight);
        return;
      }

      // Either the highlight is gone (the note outlived it) or the viewer isn't
      // ready yet — the page is the most we can honestly do.
      const viewer = highlighterInstanceRef.current?.viewer;
      if (!viewer) {
        toast.error("The document is still loading", { duration: 3000 });
        return;
      }
      viewer.scrollPageIntoView({ pageNumber });
    });

    return () => setJumpToHighlight(null);
  }, [highlights, setJumpToHighlight]);

  // Remember where in the text layer the selection started, so "Read the text"
  // can begin at that word rather than at the top of the selection.
  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

      const range = sel.getRangeAt(0);
      const startNode = range.startContainer;
      let el: Element | null =
        startNode instanceof Element ? startNode : startNode.parentElement;

      while (el && !el.matches?.('span[role="presentation"]')) {
        el = el.parentElement;
      }
      if (!el) return;

      const pageEl = el.closest(".page[data-page-number]");
      if (!pageEl) return;

      const pn = parseInt(pageEl.getAttribute("data-page-number") ?? "", 10);
      if (isNaN(pn)) return;

      const allBlocks = pageEl.querySelectorAll("span[role='presentation']");
      const blockIdx = Array.from(allBlocks).indexOf(el);
      if (blockIdx === -1) return;

      const measureRange = document.createRange();
      measureRange.setStart(el, 0);
      measureRange.setEnd(range.startContainer, range.startOffset);
      const offsetInBlock = measureRange.toString().length;
      measureRange.detach();

      selectionInfoRef.current = {
        blockIndex: blockIdx,
        offsetInBlock,
        pageNumber: pn,
      };
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // Backs the "disable links" toggle in the settings menu: pdf.js renders real
  // anchors in its annotation layer, so suppressing them means swallowing the
  // click before it navigates.
  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      if (!linksDisabled) return;

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const linkElement = target.closest(".annotationLayer a[href]");
      if (linkElement) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", handleLinkClick, true);
    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [linksDisabled]);

  return (
    <PdfHighlighterComponent
      ref={setHighlighterRef}
      pdfDocument={pdfDocument}
      pdfScaleValue={pdfScaleValue}
      enableAreaSelection={(event) => event.altKey}
      onScrollChange={() => {}}
      scrollRef={(scrollTo) => {
        scrollToHighlightRef.current = scrollTo;
      }}
      onSelectionFinished={(
        position,
        content,
        hideTipAndSelection,
        transformSelection,
      ) => (
        <TextSelectionPopover
          showAiFeatures={showAiFeatures}
          sendMessage={sendMessage}
          content={content}
          hideTipAndSelection={hideTipAndSelection}
          addHighlight={() => addHighlight({ content, position })}
          readSelectedText={readSelectedText}
          selectionInfoRef={selectionInfoRef}
          transformSelection={transformSelection}
        />
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
        const isTextHighlight = highlight.position.rects?.length !== 0;

        const component = isTextHighlight ? (
          <div id={highlight.id}>
            <Highlight
              isScrolledTo={isScrolledTo}
              position={highlight.position}
              comment={highlight.comment}
            />
          </div>
        ) : (
          <div id={highlight.id}>
            <AreaHighlight
              isScrolledTo={isScrolledTo}
              highlight={highlight}
              onChange={(boundingRect) =>
                updateAreaHighlight(
                  highlight.id,
                  viewportToScaled(boundingRect),
                  boundingRect.pageNumber,
                )
              }
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
            onMouseOver={(popupContent) => setTip(highlight, () => popupContent)}
            onMouseOut={hideTip}
            key={index}
          >
            {component}
          </Popup>
        );
      }}
      highlights={highlights as unknown as IHighlight[]}
    />
  );
};

export default PdfHighlighter;

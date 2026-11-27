import {
  HighlightedTextPopover,
  TextSelectionPopover,
  type ReadSelectedText,
  type SelectionInfo,
} from "./highlight-popover";
import { PdfPageTone } from "./page-tone";
import { PdfSearch } from "./pdf-search";
import { getHighlightPageNumber } from "../../lib/highlights";
import {
  useChatStore,
  useCitationHighlightStore,
  useHighlightJumpStore,
  usePdfSettingsStore,
} from "../../lib/store";
import { createCitationNavigator } from "../../lib/citation-navigation";
import { type PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaHighlight,
  Highlight,
  type IHighlight,
  PdfHighlighter as PdfHighlighterComponent,
  Popup,
} from "react-pdf-highlighter";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import type { BookmarkLocation, RectInput } from "../../schema";

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

export interface PdfSourceFocus {
  requestId: string;
  bookmarkId: string;
  pageNumber: number;
  location: BookmarkLocation | null;
}

export interface PagePin {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  title: string;
}

const PIN_ID_PREFIX = "pin-";

function pinHighlight(pin: PagePin): IHighlight {
  const point = {
    x1: pin.x,
    y1: pin.y,
    x2: pin.x,
    y2: pin.y,
    width: 1,
    height: 1,
    pageNumber: pin.pageNumber,
  };
  return {
    id: `${PIN_ID_PREFIX}${pin.id}`,
    position: { boundingRect: point, rects: [], pageNumber: pin.pageNumber },
    content: { text: pin.title },
    comment: { text: "", emoji: "" },
  };
}

function pagePointFromEvent(
  event: MouseEvent,
  viewer: HighlighterInstance["viewer"],
): { pageNumber: number; x: number; y: number } | null {
  if (!(event.target instanceof Element)) return null;
  const pageElement = event.target.closest<HTMLElement>(
    ".page[data-page-number]",
  );
  const pageNumber = Number(pageElement?.dataset.pageNumber);
  if (!pageElement || !Number.isInteger(pageNumber)) return null;
  const pageView = viewer.getPageView(pageNumber - 1);
  if (!pageView?.pdfPage) return null;

  const box = pageElement.getBoundingClientRect();
  const [pdfX, pdfY] = pageView.viewport.convertToPdfPoint(
    event.clientX - box.left - pageElement.clientLeft,
    event.clientY - box.top - pageElement.clientTop,
  ) as [number, number];
  const [left, bottom, right, top] = pageView.pdfPage.view as number[];
  const x = (pdfX - left!) / (right! - left!);
  const y = (top! - pdfY) / (top! - bottom!);
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return null;
  return { pageNumber, x, y };
}

function sourceHighlightFromFocus(focus: PdfSourceFocus): IHighlight | null {
  if (focus.location?.kind !== "selection") return null;

  const withPage = (rect: RectInput) => ({
    ...rect,
    pageNumber: rect.pageNumber ?? focus.pageNumber,
  });

  return {
    id: `source-${focus.requestId}`,
    position: {
      boundingRect: withPage(focus.location.position.boundingRect),
      rects: focus.location.position.rects.map(withPage),
      pageNumber: focus.pageNumber,
    },
    content: { text: focus.location.exact },
    comment: { text: "", emoji: "" },
  };
}

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
  addBookmark,
  focusedSource,
  onSourceFocusEnd,
  pins = [],
  pinDropActive = false,
  onPinDrop,
  onPinDropCancel,
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
  addBookmark?: (args: {
    content: { text?: string; image?: string };
    position: IHighlight["position"];
  }) => void;
  focusedSource?: PdfSourceFocus | null;
  onSourceFocusEnd?: () => void;
  pins?: PagePin[];
  pinDropActive?: boolean;
  onPinDrop?: (point: { pageNumber: number; x: number; y: number }) => void;
  onPinDropCancel?: () => void;
  // Whether the document is indexed — the AI actions are hidden until it is.
  showAiFeatures: boolean;
}) => {
  const sendMessage = useChatStore((state) => state.sendMessage);
  const stageImageAttachment = useChatStore(
    (state) => state.stageImageAttachment,
  );
  const linksDisabled = usePdfSettingsStore((state) => state.linksDisabled);

  const selectionInfoRef = useRef<SelectionInfo | null>(null);
  const sourceHighlight = useMemo(
    () => (focusedSource ? sourceHighlightFromFocus(focusedSource) : null),
    [focusedSource],
  );
  const pinHighlights = useMemo(() => pins.map(pinHighlight), [pins]);
  const focusedPinHighlight = useMemo(
    () =>
      focusedSource?.location?.kind === "point"
        ? pinHighlights.find(
            (pin) => pin.id === `${PIN_ID_PREFIX}${focusedSource.bookmarkId}`,
          ) ?? null
        : null,
    [focusedSource, pinHighlights],
  );
  // react-pdf-highlighter only repaints its layers when this array changes, so a pin's focus must change it too.
  const renderedHighlights = useMemo(
    () => [
      ...highlights,
      ...pinHighlights,
      ...(sourceHighlight ? [sourceHighlight] : []),
    ],
    [highlights, pinHighlights, sourceHighlight, focusedPinHighlight],
  );

  // Handed to us by the viewer once the document is ready.
  const scrollToHighlightRef = useRef<((highlight: IHighlight) => void) | null>(
    null,
  );
  const setJumpToHighlight = useHighlightJumpStore(
    (state) => state.setJumpToHighlight,
  );
  const setHighlightSource = useCitationHighlightStore(
    (state) => state.setHighlightSource,
  );

  // Keep the mounted instance locally (for the jump fallback below) as well as
  // handing it to the caller.
  const highlighterInstanceRef = useRef<HighlighterInstance | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [highlighterInstance, setHighlighterInstance] =
    useState<HighlighterInstance | null>(null);
  const setHighlighterRef = useCallback(
    (instance: HighlighterInstance | null) => {
      highlighterInstanceRef.current = instance;
      setHighlighterInstance(instance);
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

  useEffect(() => {
    if (!focusedSource || !viewerReady) return;

    const scrollToHighlight = scrollToHighlightRef.current;
    if (sourceHighlight && scrollToHighlight) {
      scrollToHighlight(sourceHighlight);
      return;
    }
    const container = highlighterInstanceRef.current?.viewer.container;
    if (focusedPinHighlight && scrollToHighlight && container) {
      scrollToHighlight(focusedPinHighlight);
      container.scrollTop -= container.clientHeight / 2;
      return;
    }

    highlighterInstanceRef.current?.viewer.scrollPageIntoView({
      pageNumber: focusedSource.pageNumber,
    });
  }, [focusedSource, sourceHighlight, focusedPinHighlight, viewerReady]);

  const viewerContainer = highlighterInstance?.containerNode ?? null;
  useEffect(() => {
    if (!sourceHighlight || !viewerContainer || !onSourceFocusEnd) return;
    viewerContainer.addEventListener("pointerdown", onSourceFocusEnd, {
      once: true,
    });
    return () =>
      viewerContainer.removeEventListener("pointerdown", onSourceFocusEnd);
  }, [sourceHighlight, viewerContainer, onSourceFocusEnd]);

  useEffect(() => {
    if (!focusedPinHighlight || !viewerContainer || !onSourceFocusEnd) return;
    const endFocus = (event: AnimationEvent) => {
      if (
        event.target instanceof Element &&
        event.target.classList.contains("uxie-pin-focus")
      ) {
        onSourceFocusEnd();
      }
    };
    viewerContainer.addEventListener("animationend", endFocus);
    return () => viewerContainer.removeEventListener("animationend", endFocus);
  }, [focusedPinHighlight, viewerContainer, onSourceFocusEnd]);

  useEffect(() => {
    if (!pinDropActive || !viewerContainer) return;
    const viewer = highlighterInstanceRef.current?.viewer;
    if (!viewer) return;

    const swallow = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest(".page[data-page-number]")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const drop = (event: PointerEvent) => {
      const point = pagePointFromEvent(event, viewer);
      if (!point) return;
      swallow(event);
      onPinDrop?.(point);
    };
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") onPinDropCancel?.();
    };

    viewerContainer.classList.add("uxie-pin-drop");
    viewerContainer.addEventListener("pointerdown", drop, true);
    viewerContainer.addEventListener("mousedown", swallow, true);
    viewerContainer.addEventListener("click", swallow, true);
    document.addEventListener("keydown", cancel);
    return () => {
      viewerContainer.classList.remove("uxie-pin-drop");
      viewerContainer.removeEventListener("pointerdown", drop, true);
      viewerContainer.removeEventListener("mousedown", swallow, true);
      viewerContainer.removeEventListener("click", swallow, true);
      document.removeEventListener("keydown", cancel);
    };
  }, [pinDropActive, viewerContainer, onPinDrop, onPinDropCancel]);

  useEffect(() => {
    const navigator = createCitationNavigator({
      getViewer: () => highlighterInstanceRef.current?.viewer ?? null,
      onError: (message) => toast.error(message, { duration: 3000 }),
      subscribeTextLayerRendered: (listener) => {
        const eventBus = highlighterInstanceRef.current?.eventBus;
        if (!eventBus) return () => {};
        const onRendered = ({ pageNumber }: { pageNumber?: number }) => {
          if (pageNumber) listener(pageNumber);
        };
        eventBus.on("textlayerrendered", onRendered);
        return () => eventBus.off("textlayerrendered", onRendered);
      },
    });
    setHighlightSource((source) => {
      if (source.kind !== "pdf") {
        toast.error("That source isn't part of this PDF", { duration: 3000 });
        return;
      }
      navigator.showSource(source.pageNumber, source.pageContent);
    });

    return () => {
      setHighlightSource(null);
      navigator.dispose();
    };
  }, [setHighlightSource]);

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

  // react-pdf-highlighter reuses its viewer and find controller when the
  // document changes, and pdf.js hands the find controller the new document
  // asynchronously, so a search in that gap would run against the old one.
  const documentKey = pdfDocument.loadingTask.docId;

  return (
    <PdfPageTone key={documentKey}>
      <PdfHighlighterComponent
        ref={setHighlighterRef}
        pdfDocument={pdfDocument}
        pdfScaleValue={pdfScaleValue}
        enableAreaSelection={(event) => event.altKey}
        onScrollChange={() => {}}
        scrollRef={(scrollTo) => {
          scrollToHighlightRef.current = scrollTo;
          setViewerReady(true);
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
            stageImageAttachment={stageImageAttachment}
            content={content}
            hideTipAndSelection={hideTipAndSelection}
            addHighlight={() => addHighlight({ content, position })}
            addBookmark={
              addBookmark ? () => addBookmark({ content, position }) : undefined
            }
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
          if (highlight.id.startsWith(PIN_ID_PREFIX)) {
            const focused = highlight.id === focusedPinHighlight?.id;
            return (
              <div
                key={
                  focused
                    ? `${highlight.id}-${focusedSource?.requestId}`
                    : index
                }
                id={highlight.id}
                role="img"
                aria-label={highlight.content.text}
                title={highlight.content.text}
                className={cn("uxie-pin", focused && "uxie-pin-focus")}
                style={{
                  left: highlight.position.boundingRect.left,
                  top: highlight.position.boundingRect.top,
                }}
              />
            );
          }

          const isTextHighlight = highlight.position.rects?.length !== 0;
          const isFocusedSource = highlight.id === sourceHighlight?.id;

          if (isFocusedSource) {
            return (
              <div id={highlight.id} className="uxie-source-focus" key={index}>
                <Highlight
                  isScrolledTo={isScrolledTo}
                  position={highlight.position}
                  comment={highlight.comment}
                />
              </div>
            );
          }

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
              onMouseOver={(popupContent) =>
                setTip(highlight, () => popupContent)
              }
              onMouseOut={hideTip}
              key={index}
            >
              {component}
            </Popup>
          );
        }}
        highlights={renderedHighlights as unknown as IHighlight[]}
      />
      <PdfSearch
        eventBus={highlighterInstance?.eventBus ?? null}
        viewerContainer={highlighterInstance?.containerNode ?? null}
      />
    </PdfPageTone>
  );
};

export default PdfHighlighter;

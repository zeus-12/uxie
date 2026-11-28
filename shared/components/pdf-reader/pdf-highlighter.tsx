import { HighlightedTextPopover, TextSelectionPopover } from "./highlight-popover";
import { PdfPageTone } from "./page-tone";
import { AnchoredPopover } from "./anchored-popover";
import { READING_MODE } from "./constants";
import { rectAnchor, type AnchorSource } from "../../lib/popover-placement";
import type { HighlightColor } from "../../lib/highlight-colors";
import { useHighlightTip, useSelectionTip } from "../../hooks/use-reader-tips";
import { getPagesFromRange } from "react-pdf-highlighter/dist/esm/lib/pdfjs-dom";
import getClientRects from "react-pdf-highlighter/dist/esm/lib/get-client-rects";
import getBoundingRect from "react-pdf-highlighter/dist/esm/lib/get-bounding-rect";
import { createPortal } from "react-dom";
import { PdfSearch } from "./pdf-search";
import { getHighlightPageNumber } from "../../lib/highlights";
import {
  useChatStore,
  useCitationHighlightStore,
  useHighlightJumpStore,
  usePdfSettingsStore,
  usePublishHighlightColors,
} from "../../lib/store";
import { createCitationNavigator } from "../../lib/citation-navigation";
import { type PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Rect as PdfRect } from "../../lib/reflow/types";
import { useInPlaceReflow } from "./reflow/use-in-place-reflow";
import { createPdfTextSource, usePdfTextStore } from "../../lib/pdf-text";
import type { ReflowSelection } from "./reflow/selection";
import {
  AreaHighlight,
  Highlight,
  type IHighlight,
  PdfHighlighter as PdfHighlighterComponent,
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

export type ReaderHighlight = {
  id: string;
  color: HighlightColor;
  text?: string | null;
  position: {
    boundingRect: Rect;
    rects: Rect[];
    pageNumber?: number | null;
  };
};

export type HighlighterInstance = InstanceType<typeof PdfHighlighterComponent>;

type ScaledRect = IHighlight["position"]["boundingRect"];
type ScaledPosition = IHighlight["position"];

type SelectionInfo = { blockIndex: number; offsetInBlock: number; pageNumber: number };

export type ReadSelectedText = (args: {
  text?: string;
  readingSpeed?: number;
  continueReadingFromLastPosition?: boolean;
  readingMode: READING_MODE;
  selectionBlockIndex?: number;
  selectionOffsetInBlock?: number;
  selectionPageNumber?: number;
}) => Promise<void>;

type PageSelection =
  | { kind: "text"; text: string; position: ScaledPosition; info: SelectionInfo | null }
  | { kind: "area"; image: string; position: ScaledPosition; reset: () => void };

const GHOST_ID = "uxie-selection-ghost";

// Where in the text layer the selection starts, so "Read the text" begins at that word.
function selectionInfoFor(range: Range): SelectionInfo | null {
  const start = range.startContainer;
  const block = (start instanceof Element ? start : start.parentElement)?.closest(
    'span[role="presentation"]',
  );
  const page = block?.closest(".page[data-page-number]");
  const pageNumber = Number(page?.getAttribute("data-page-number"));
  if (!block || !page || !Number.isInteger(pageNumber)) return null;
  const blockIndex = [...page.querySelectorAll('span[role="presentation"]')].indexOf(block);
  if (blockIndex === -1) return null;
  const before = document.createRange();
  before.setStart(block, 0);
  before.setEnd(range.startContainer, range.startOffset);
  return { blockIndex, offsetInBlock: before.toString().length, pageNumber };
}

function areaAnchor(
  viewer: HighlighterInstance["viewer"] | undefined,
  rect: ScaledRect,
  pageNumber: number,
): AnchorSource {
  return rectAnchor(() => {
    const page = viewer?.getPageView(pageNumber - 1)?.div;
    if (!page || !rect.width || !rect.height) return null;
    const box = page.getBoundingClientRect();
    const sx = box.width / rect.width;
    const sy = box.height / rect.height;
    return new DOMRect(
      box.left + rect.x1 * sx,
      box.top + rect.y1 * sy,
      (rect.x2 - rect.x1) * sx,
      (rect.y2 - rect.y1) * sy,
    );
  });
}

const PdfHighlighter = ({
  pdfDocument,
  highlights,
  pdfScaleValue,
  highlighterRef,
  addHighlight,
  deleteHighlight,
  recolorHighlight,
  updateAreaHighlight,
  readSelectedText,
  showAiFeatures,
  onZoomChange,
  onReflowChange,
}: {
  pdfDocument: PDFDocumentProxy;
  highlights: ReaderHighlight[];
  pdfScaleValue: string;
  highlighterRef?: (instance: HighlighterInstance | null) => void;
  addHighlight: (args: {
    content: { text?: string; image?: string };
    position: IHighlight["position"];
    color: HighlightColor;
  }) => void;
  deleteHighlight: (id: string) => void;
  recolorHighlight: (id: string, color: HighlightColor) => void;
  updateAreaHighlight: (
    id: string,
    boundingRect: Rect,
    pageNumber?: number,
  ) => void;
  readSelectedText: ReadSelectedText;
  showAiFeatures: boolean;
  onZoomChange?: (scale: number, persist: boolean) => void;
  onReflowChange?: (reflowed: boolean) => void;
}) => {
  const sendMessage = useChatStore((state) => state.sendMessage);
  const stageImageAttachment = useChatStore(
    (state) => state.stageImageAttachment,
  );
  const linksDisabled = usePdfSettingsStore((state) => state.linksDisabled);
  const reflowOnZoom = usePdfSettingsStore((state) => state.reflowOnZoom);
  const setTextSource = usePdfTextStore((state) => state.setSource);
  useEffect(() => {
    const source = createPdfTextSource(pdfDocument);
    setTextSource(source);
    return () => {
      if (usePdfTextStore.getState().source === source) setTextSource(null);
    };
  }, [pdfDocument, setTextSource]);

  const reflowActiveRef = useRef(false);

  const highlightColors = usePublishHighlightColors(highlights);
  const showReflowPointRef = useRef<((pageNumber: number, fx: number, fy: number) => void) | null>(null);

  const scrollToHighlightRef = useRef<((highlight: IHighlight) => void) | null>(
    null,
  );
  const setJumpToHighlight = useHighlightJumpStore(
    (state) => state.setJumpToHighlight,
  );
  const setHighlightSource = useCitationHighlightStore(
    (state) => state.setHighlightSource,
  );

  const highlighterInstanceRef = useRef<HighlighterInstance | null>(null);
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

  // Jumps by page, not element id: pdf.js only keeps nearby pages rendered, so
  // a highlight's DOM node doesn't exist until its page is in view.
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

      const first = highlight?.position.rects[0] ?? highlight?.position.boundingRect;
      if (reflowActiveRef.current && first?.width && first.height && first.x1 !== undefined && first.y1 !== undefined) {
        showReflowPointRef.current?.(pageNumber, first.x1 / first.width, first.y1 / first.height);
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

  // pdf.js renders real anchors in its annotation layer, so disabling links
  // means swallowing the click before it navigates.
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

  const highlightById = useMemo(
    () => new Map(highlights.map((h) => [h.id, h])),
    [highlights],
  );

  const highlightRects = useCallback(
    (pageNumber: number, pageWidth: number, pageHeight: number) =>
      highlights
        .map((h) => ({
          id: h.id,
          rects: h.position.rects
            .filter((r) => (r.pageNumber ?? getHighlightPageNumber(h.position)) === pageNumber)
            .flatMap((r): PdfRect[] => {
              const { x1, y1, x2, y2, width, height } = r;
              if (
                x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined ||
                !width || !height
              ) {
                return [];
              }
              const sx = pageWidth / width;
              const sy = pageHeight / height;
              return [{ x: x1 * sx, y: y1 * sy, width: (x2 - x1) * sx, height: (y2 - y1) * sy }];
            }),
        }))
        .filter((region) => region.rects.length > 0),
    [highlights],
  );

  const askAi = showAiFeatures && sendMessage ? sendMessage : undefined;

  const highlightPopover = useCallback(
    (id: string, close: () => void) => {
      const highlight = highlightById.get(id);
      if (!highlight) return null;
      const text = highlight.text ?? null;
      return (
        <HighlightedTextPopover
          text={text}
          color={highlight.color}
          onRead={
            text
              ? () =>
                  void readSelectedText({
                    text,
                    readingMode: READING_MODE.TEXT,
                    selectionPageNumber: getHighlightPageNumber(highlight.position) ?? undefined,
                  })
              : undefined
          }
          onRecolor={(color) => recolorHighlight(id, color)}
          onDelete={() => deleteHighlight(id)}
          onAskAi={askAi}
          close={close}
        />
      );
    },
    [highlightById, readSelectedText, recolorHighlight, deleteHighlight, askAi],
  );

  const textSelectionPopover = (
    text: string,
    info: SelectionInfo | null,
    resolvePosition: () => Promise<ScaledPosition | null>,
    close: () => void,
    keepVisible: () => void,
  ) => (
    <TextSelectionPopover
      text={text}
      onHighlight={(color) => {
        void resolvePosition()
          .then((position) => {
            if (!position) throw new Error("no position");
            addHighlight({ content: { text }, position, color });
          })
          .catch(() => toast.error("Couldn't create the highlight"));
      }}
      onRead={() =>
        void readSelectedText({
          text,
          readingMode: READING_MODE.TEXT,
          selectionBlockIndex: info?.blockIndex,
          selectionOffsetInBlock: info?.offsetInBlock,
          selectionPageNumber: info?.pageNumber,
        })
      }
      onAskAi={askAi}
      onAskAiStart={keepVisible}
      close={close}
    />
  );

  const renderReflowSelection = (selection: ReflowSelection, close: () => void, keepVisible: () => void) =>
    textSelectionPopover(selection.text, selection.start, selection.resolvePosition, close, keepVisible);

  const reflow = useInPlaceReflow({
    renderSelection: renderReflowSelection,
    renderHighlight: highlightPopover,
    enabled: reflowOnZoom,
    instance: highlighterInstance,
    pdfDocument,
    highlightRects,
    highlightColors,
    onZoomChange,
  });
  const { bindPinch, active: reflowed } = reflow;
  reflowActiveRef.current = reflowed;
  showReflowPointRef.current = reflow.showPagePoint;
  useEffect(() => {
    onReflowChange?.(reflowed);
    return () => onReflowChange?.(false);
  }, [onReflowChange, reflowed]);
  const [pinchSurface, setPinchSurface] = useState<HTMLDivElement | null>(null);
  useEffect(() => bindPinch(pinchSurface), [bindPinch, pinchSurface]);

  const pageRoot = highlighterInstance?.containerNode ?? null;
  const describePageSelection = useCallback(
    (selection: Selection, range: Range): PageSelection | null => {
      const instance = highlighterInstanceRef.current;
      const pages = getPagesFromRange(range);
      if (!instance || pages.length === 0) return null;
      const rects = getClientRects(range, pages);
      if (rects.length === 0) return null;
      const position = instance.viewportPositionToScaled({
        boundingRect: getBoundingRect(rects),
        rects,
        pageNumber: pages[0]!.number,
      });
      const text = selection.toString().split("\n").join(" ");
      return { kind: "text", text, position, info: selectionInfoFor(range) };
    },
    [],
  );
  const selectionTip = useSelectionTip(pageRoot, describePageSelection);
  const highlightTip = useHighlightTip(pageRoot, { suspended: selectionTip.tip !== null });
  const [ghost, setGhost] = useState<ScaledPosition | null>(null);
  const openSelection = useRef<PageSelection | null>(null);
  useEffect(() => {
    const previous = openSelection.current;
    openSelection.current = selectionTip.tip?.value ?? null;
    if (selectionTip.tip) return;
    setGhost(null);
    if (previous?.kind === "area") previous.reset();
  }, [selectionTip.tip]);
  const closeSelection = useCallback(() => {
    selectionTip.close();
    window.getSelection()?.removeAllRanges();
  }, [selectionTip.close]);

  const viewerHighlights = useMemo(
    () =>
      ghost
        ? [...highlights, { id: GHOST_ID, position: ghost }]
        : highlights,
    [highlights, ghost],
  );

  const selection = selectionTip.tip?.value;
  const selectionPopover =
    selection?.kind === "text" ? (
      textSelectionPopover(
        selection.text,
        selection.info,
        () => Promise.resolve(selection.position),
        closeSelection,
        () => setGhost(selection.position),
      )
    ) : selection?.kind === "area" ? (
      <TextSelectionPopover
        image={selection.image}
        onHighlight={(color) =>
          addHighlight({ content: { image: selection.image }, position: selection.position, color })
        }
        onAttach={
          stageImageAttachment
            ? () => {
                stageImageAttachment(selection.image);
                useChatStore.getState().focusInput?.();
              }
            : undefined
        }
        close={closeSelection}
      />
    ) : null;

  // The library reuses its find controller across documents and pdf.js hands it
  // the new one asynchronously, so a search in that gap hits the old document.
  const documentKey = pdfDocument.loadingTask.docId;

  return (
    <PdfPageTone key={documentKey}>
    <div
      ref={setPinchSurface}
      className="absolute inset-0"
      data-reflow-on-zoom={reflowOnZoom || undefined}
    >
      <PdfHighlighterComponent
        ref={setHighlighterRef}
        pdfDocument={pdfDocument}
        pdfScaleValue={pdfScaleValue}
        enableAreaSelection={(event) => event.altKey}
        onScrollChange={() => {}}
        scrollRef={(scrollTo) => {
          scrollToHighlightRef.current = scrollTo;
        }}
        onSelectionFinished={(position, content, hideTipAndSelection) => {
          if (content.image) {
            selectionTip.show(
              { kind: "area", image: content.image, position, reset: hideTipAndSelection },
              areaAnchor(highlighterInstanceRef.current?.viewer, position.boundingRect, position.pageNumber),
            );
          }
          return null;
        }}
        highlightTransform={(
          highlight,
          index,
          _setTip,
          _hideTip,
          viewportToScaled,
          _screenshot,
          isScrolledTo,
        ) => {
          const stored = highlightById.get(highlight.id);
          const isTextHighlight = highlight.position.rects?.length !== 0;

          const component = isTextHighlight ? (
            <div
              key={index}
              id={highlight.id}
              data-highlight-id={stored?.id}
              data-highlight-color={stored?.color}
            >
              <Highlight
                isScrolledTo={isScrolledTo}
                position={highlight.position}
                comment={highlight.comment}
              />
            </div>
          ) : (
            <div
              key={index}
              id={highlight.id}
              data-highlight-id={stored?.id}
              data-highlight-color={stored?.color}
            >
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

          return component;
        }}
        highlights={viewerHighlights as unknown as IHighlight[]}
      />
      {pageRoot &&
        createPortal(
          <>
            {highlightTip.tip && (
              <AnchoredPopover
                key={highlightTip.tip.id}
                ref={highlightTip.popoverRef}
                anchor={highlightTip.tip.anchor}
              >
                {highlightPopover(highlightTip.tip.id, highlightTip.close)}
              </AnchoredPopover>
            )}
            {selectionTip.tip && selectionPopover && (
              <AnchoredPopover ref={selectionTip.popoverRef} anchor={selectionTip.tip.anchor}>
                {selectionPopover}
              </AnchoredPopover>
            )}
          </>,
          pageRoot,
        )}
      {reflow.layer}
      <PdfSearch
        eventBus={highlighterInstance?.eventBus ?? null}
        viewerContainer={highlighterInstance?.containerNode ?? null}
      />
    </div>
    </PdfPageTone>
  );
};

export default PdfHighlighter;

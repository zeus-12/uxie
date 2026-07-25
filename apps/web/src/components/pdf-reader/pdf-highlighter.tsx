import { READING_MODE } from "@/components/pdf-reader/constants";
import {
  HighlightedTextPopover,
  TextSelectionPopover,
} from "@/components/pdf-reader/highlight-popover";
import { api } from "@/lib/api";
import { usePdfSettingsStore } from "@/lib/store";
import { getHighlightPageNumber } from "@uxie/shared/lib/highlights";
import { useChatStore, useHighlightJumpStore } from "@uxie/shared/lib/store";
import {
  type AddHighlightType,
  type HighlightPositionType,
} from "@/types/highlight";
import { type ReaderDoc } from "@/types/reader";
import { HighlightTypeEnum } from "@prisma/client";
import { type PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  AreaHighlight,
  Highlight,
  type IHighlight,
  PdfHighlighter as PdfHighlighterComponent,
  Popup,
} from "react-pdf-highlighter";
import { toast } from "sonner";

const PdfHighlighter = ({
  pdfDocument,
  doc,
  addHighlight,
  deleteHighlight,
  readSelectedText,
  onUpdateAreaHighlight,
  pdfScaleValue,
  highlighterRef,
}: {
  pdfDocument: PDFDocumentProxy;
  doc: ReaderDoc;
  pdfScaleValue: string;
  // Hands the mounted PdfHighlighter instance (and so its pdf.js PDFViewer) to
  // the caller, which needs it to track the page in view and apply zoom.
  highlighterRef?: (
    instance: InstanceType<typeof PdfHighlighterComponent> | null,
  ) => void;
  addHighlight: ({ content, position }: AddHighlightType) => Promise<void>;
  deleteHighlight: (id: string) => void;
  // When provided (e.g. the local demo), area-highlight resizes persist through
  // this callback instead of the tRPC mutation.
  onUpdateAreaHighlight?: (
    id: string,
    boundingRect: HighlightPositionType["boundingRect"],
    pageNumber?: number,
  ) => void;
  readSelectedText: (args: {
    text?: string | null;
    readingSpeed?: number;
    continueReadingFromLastPosition?: boolean;
    readingMode: READING_MODE;
    selectionBlockIndex?: number;
    selectionOffsetInBlock?: number;
    selectionPageNumber?: number;
  }) => Promise<void>;
}) => {
  const highlights = useMemo(() => doc.highlights ?? [], [doc.highlights]);
  const utils = api.useContext();
  const { sendMessage } = useChatStore();
  const linksDisabled = usePdfSettingsStore((state) => state.linksDisabled);

  const selectionInfoRef = useRef<{
    blockIndex: number;
    offsetInBlock: number;
    pageNumber: number;
  } | null>(null);

  // Handed to us by the viewer once the document is ready.
  const scrollToHighlightRef = useRef<((highlight: IHighlight) => void) | null>(
    null,
  );
  const setJumpToHighlight = useHighlightJumpStore(
    (state) => state.setJumpToHighlight,
  );

  // Keep the mounted instance locally (for the jump fallback below) as well as
  // handing it to the caller.
  const highlighterInstanceRef = useRef<InstanceType<
    typeof PdfHighlighterComponent
  > | null>(null);
  const setHighlighterRef = useCallback(
    (instance: InstanceType<typeof PdfHighlighterComponent> | null) => {
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

  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

      const range = sel.getRangeAt(0);
      const startNode = range.startContainer;
      let el: Element | null =
        startNode instanceof Element
          ? startNode
          : startNode.parentElement;

      while (el && !el.matches?.('span[role="presentation"]')) {
        el = el.parentElement;
      }
      if (!el) return;

      const pageEl = el.closest(".page[data-page-number]");
      if (!pageEl) return;

      const pn = parseInt(
        pageEl.getAttribute("data-page-number") ?? "",
        10,
      );
      if (isNaN(pn)) return;

      const allBlocks = pageEl.querySelectorAll(
        "span[role='presentation']",
      );
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

  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      if (linksDisabled) {
        const target = event.target;

        if (!(target instanceof HTMLElement)) return;

        const linkElement = target.closest(".annotationLayer a[href]");
        if (linkElement) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    };

    document.addEventListener("click", handleLinkClick, true);
    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [linksDisabled]);

  const { mutate: updateAreaHighlight } =
    api.highlight.updateAreaHighlight.useMutation({
      async onMutate(newHighlight) {
        await utils.document.getDocData.cancel();
        const prevData = utils.document.getDocData.getData();

        utils.document.getDocData.setData({ docId: doc.id }, (old) => {
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
        toast.error("Something went wrong", {
          duration: 3000,
        });

        utils.document.getDocData.setData({ docId: doc.id }, ctx?.prevData);
      },
      onSettled() {
        utils.document.getDocData.invalidate();
      },
    });

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
      ) => {
        return (
          <TextSelectionPopover
            showAiFeatures={doc.isVectorised}
            sendMessage={sendMessage}
            content={content}
            hideTipAndSelection={hideTipAndSelection}
            position={position}
            addHighlight={() => addHighlight({ content, position })}
            readSelectedText={readSelectedText}
            selectionInfoRef={selectionInfoRef}
            transformSelection={transformSelection}
          />
        );
      }}
      highlightTransform={(
        highlight,
        index,
        setTip,
        hideTip,
        viewportToScaled,
        screenshot,
        isScrolledTo,
      ) => {
        const isTextHighlight = highlight.position.rects?.length !== 0;

        const component = isTextHighlight ? (
          <div id={highlight.id}>
            {/* @ts-ignore */}
            <Highlight
              isScrolledTo={isScrolledTo}
              position={highlight.position}
            />
          </div>
        ) : (
          <div id={highlight.id}>
            <AreaHighlight
              isScrolledTo={isScrolledTo}
              highlight={highlight}
              onChange={(boundingRect) => {
                if (onUpdateAreaHighlight) {
                  onUpdateAreaHighlight(
                    highlight.id,
                    viewportToScaled(boundingRect),
                    boundingRect.pageNumber,
                  );
                  return;
                }
                updateAreaHighlight({
                  id: highlight.id,
                  boundingRect: viewportToScaled(boundingRect),
                  type: HighlightTypeEnum.IMAGE,
                  documentId: doc.id,
                  ...(boundingRect.pageNumber
                    ? { pageNumber: boundingRect.pageNumber }
                    : {}),
                });
              }}
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
              setTip(highlight, (highlight) => popupContent)
            }
            onMouseOut={hideTip}
            key={index}
          >
            {component}
          </Popup>
        );
      }}
      // @ts-ignore
      highlights={highlights}
    />
  );
};

export default PdfHighlighter;

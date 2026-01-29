import { READING_MODE } from "@/components/pdf-reader/constants";
import {
  HighlightedTextPopover,
  TextSelectionPopover,
} from "@/components/pdf-reader/highlight-popover";
import { api } from "@/lib/api";
import { useChatStore, usePdfSettingsStore } from "@/lib/store";
import { type AppRouter } from "@/server/api/root";
import { type AddHighlightType } from "@/types/highlight";
import { HighlightTypeEnum } from "@prisma/client";
import { type inferRouterOutputs } from "@trpc/server";
import { type PDFDocumentProxy } from "pdfjs-dist";
import { useEffect } from "react";
import {
  AreaHighlight,
  Highlight,
  PdfHighlighter as PdfHighlighterComponent,
  Popup,
} from "react-pdf-highlighter";
import { toast } from "sonner";

const parseIdFromHash = () => document.location.hash.slice(1);

const resetHash = () => {
  document.location.hash = "";
};

const getHighlightById = (
  id: string,
  doc: inferRouterOutputs<AppRouter>["document"]["getDocData"],
) => {
  return doc?.highlights?.find((highlight) => highlight.id === id);
};

let scrollViewerTo = (highlight: any) => {};

const scrollToHighlightFromHash = (
  doc: inferRouterOutputs<AppRouter>["document"]["getDocData"],
) => {
  const highlight = getHighlightById(parseIdFromHash(), doc);

  if (highlight) {
    scrollViewerTo(highlight);
  }
};

const PdfHighlighter = ({
  pdfDocument,
  doc,
  addHighlight,
  deleteHighlight,
  readSelectedText,
}: {
  pdfDocument: PDFDocumentProxy;
  doc: inferRouterOutputs<AppRouter>["document"]["getDocData"];
  addHighlight: ({ content, position }: AddHighlightType) => Promise<void>;
  deleteHighlight: (id: string) => void;
  readSelectedText: ({
    text,
    readingSpeed,
    continueReadingFromLastPosition,
    readingMode,
  }: {
    text?: string | null;
    readingSpeed?: number;
    continueReadingFromLastPosition?: boolean;
    readingMode: READING_MODE;
  }) => Promise<void>;
}) => {
  const highlights = doc.highlights ?? [];
  const utils = api.useContext();
  const { sendMessage } = useChatStore();
  const linksDisabled = usePdfSettingsStore((state) => state.linksDisabled);

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
      pdfDocument={pdfDocument}
      enableAreaSelection={(event) => event.altKey}
      onScrollChange={resetHash}
      scrollRef={(scrollTo) => {
        scrollViewerTo = scrollTo;
        scrollToHighlightFromHash(doc);
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

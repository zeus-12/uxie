import { getHighlightById } from "@/components/pdf-reader";
import MyExpandableTip from "@/components/pdf-reader/expandable-tip";
import { SpinnerPage } from "@/components/ui/spinner";
import { CustomTooltip } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { useChatStore } from "@/lib/store";
import { copyTextToClipboard } from "@/lib/utils";
import { AppRouter } from "@/server/api/root";
import { CompactHighlight } from "@/types/highlight";
// import { HighlightPositionType } from "@/types/highlight";
import { inferRouterOutputs } from "@trpc/server";
import {
  BookOpenCheck,
  ClipboardCopy,
  Highlighter,
  Lightbulb,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/router";
import { useRef } from "react";
import {
  AreaHighlight,
  Highlight,
  PdfHighlighter,
  PdfHighlighterUtils,
  PdfLoader,
  TextHighlight,
  useHighlightContainerContext,
  usePdfHighlighterContext,
} from "react-pdf-highlighter-extended";
import { toast } from "sonner";

// The pdfjs library used by the client - it must match our pdfjs-dist version exactly
// the default behaviour of react-pdf-highlighter is to use unpkg
// with hardcoded version in the URL.
// import pdfJSWorkerSrc from "pdfjs-dist/build/pdf.worker?url";

interface AddHighlighType {
  content: {
    text?: string;
    image?: string;
  };
  position: CompactHighlight["position"];
}

const parseIdFromHash = () => document.location.hash.slice(1);

const resetHash = () => {
  document.location.hash = "";
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

const PdfReader = ({
  addHighlight,
  deleteHighlight,
  doc,
}: {
  addHighlight: ({ content, position }: AddHighlighType) => Promise<void>;
  deleteHighlight: (id: string) => void;
  doc: inferRouterOutputs<AppRouter>["document"]["getDocData"];
}) => {
  const utils = api.useContext();
  const highlighterUtilsRef = useRef<PdfHighlighterUtils>();

  const { url: docUrl, id: docId } = doc;
  const highlights = doc.highlights ?? [];

  const { mutate: updateAreaHighlight } =
    api.highlight.updateAreaHighlight.useMutation({
      async onMutate(newHighlight) {
        await utils.document.getDocData.cancel();
        const prevData = utils.document.getDocData.getData();

        // @ts-ignore
        utils.document.getDocData.setData({ docId: docId }, (old) => {
          if (!old) return undefined;
          return {
            ...old,
            highlights: [
              ...old.highlights.filter(
                (highlight) => highlight.id !== newHighlight.id,
              ),
              {
                position: {
                  boundingRect: newHighlight.boundingRect,
                  pageNumber: newHighlight.pageNumber,
                  rects: [],
                },
              },
            ],
          };
        });
        return { prevData };
      },
      onError(err, newPost, ctx) {
        toast.error("Something went wrong", {
          duration: 3000,
        });

        utils.document.getDocData.setData({ docId: docId }, ctx?.prevData);
      },
      onSettled() {
        utils.document.getDocData.invalidate();
      },
    });

  const { sendMessage } = useChatStore();

  return (
    <PdfLoader
      document={docUrl}
      beforeLoad={() => <SpinnerPage />}
      // workerSrc={pdfJSWorkerSrc}
    >
      {(pdfDocument) => (
        <PdfHighlighter
          // @ts-ignore
          highlights={highlights}
          pdfDocument={pdfDocument}
          enableAreaSelection={(event) => event.altKey}
          utilsRef={(_pdfHighlighterUtils) => {
            highlighterUtilsRef.current = _pdfHighlighterUtils;
          }}
          onScrollChange={resetHash}
          selectionTip={<MyExpandableTip />} // Component will render as a tip upon any selection

          // pdfScaleValue="page-width"
          // scrollRef={(scrollTo) => {
          //   scrollViewerTo = scrollTo;
          //   scrollToHighlightFromHash(doc);
          // }}

          // onSelectionFinished={(
          //   position,
          //   content,
          //   hideTipAndSelection,
          //   transformSelection,
          // ) => {
          //   return (
          //     <TextSelectionPopover
          //       sendMessage={sendMessage}
          //       content={content}
          //       hideTipAndSelection={hideTipAndSelection}
          //       position={position}
          //       addHighlight={() => addHighlight({ content, position })}
          //     />
          //   );
          // }}
          // highlightTransform={(
          //   highlight,
          //   index,
          //   setTip,
          //   hideTip,
          //   viewportToScaled,
          //   screenshot,
          //   isScrolledTo,
          // ) => {
          //   const isTextHighlight = highlight.position.rects?.length !== 0;

          //   const component = isTextHighlight ? (
          //     <div id={highlight.id}>
          //       {/* @ts-ignore */}
          //       <Highlight
          //         isScrolledTo={isScrolledTo}
          //         position={highlight.position}
          //       />
          //     </div>
          //   ) : (
          //     <div id={highlight.id}>
          //       <AreaHighlight
          //         isScrolledTo={isScrolledTo}
          //         highlight={highlight}
          //         onChange={(boundingRect) => {
          //           updateAreaHighlight({
          //             id: highlight.id,
          //             boundingRect: viewportToScaled(boundingRect),
          //             type: HighlightTypeEnum.IMAGE,
          //             documentId: docId,
          //             ...(boundingRect.pageNumber
          //               ? { pageNumber: boundingRect.pageNumber }
          //               : {}),
          //           });
          //         }}
          //       />
          //     </div>
          //   );

          //   return (
          //     <Popup
          //       popupContent={
          //         <HighlightedTextPopup
          //           id={highlight.id}
          //           deleteHighlight={deleteHighlight}
          //           hideTip={hideTip}
          //         />
          //       }
          //       onMouseOver={(popupContent) =>
          //         setTip(highlight, (highlight) => popupContent)
          //       }
          //       onMouseOut={hideTip}
          //       key={index}
          //     >
          //       {component}
          //     </Popup>
          //   );
          // }}
        >
          <MyHighlightContainer editHighlight={() => {}} />
        </PdfHighlighter>
      )}
    </PdfLoader>
  );
};

const TextSelectionPopover = ({
  content,
  hideTipAndSelection,
  position,
  addHighlight,
  sendMessage,
}: {
  position: any;
  addHighlight: () => void;
  content: {
    text?: string | undefined;
    image?: string | undefined;
  };
  hideTipAndSelection: () => void;
  sendMessage: ((message: string) => void) | null;
}) => {
  const router = useRouter();

  const switchSidebarTabToChat = () => {
    router.push({
      query: {
        ...router.query,
        tab: "chat",
      },
    });
  };

  const OPTIONS = [
    {
      onClick: () => {
        addHighlight();
        hideTipAndSelection();
      },
      icon: Highlighter,
      tooltip: "Highlight",
    },
    {
      onClick: () => {
        copyTextToClipboard(content.text, hideTipAndSelection);
        hideTipAndSelection();
      },
      icon: ClipboardCopy,
      tooltip: "Copy the text",
    },
    sendMessage && {
      onClick: () => {
        sendMessage("**Explain**: " + content.text);
        switchSidebarTabToChat();
        hideTipAndSelection();
      },
      icon: Lightbulb,
      tooltip: "Explain the text",
    },
    sendMessage && {
      onClick: () => {
        sendMessage("**Summarise**: " + content.text);
        switchSidebarTabToChat();
        hideTipAndSelection();
      },
      icon: BookOpenCheck,
      tooltip: "Summarise the text",
    },
  ].filter(Boolean);

  return (
    <div className="relative rounded-md bg-black">
      <div className="absolute -bottom-[7px] left-[50%] h-0 w-0 -translate-x-[50%] border-l-[7px] border-r-[7px] border-t-[7px] border-solid border-black border-l-transparent border-r-transparent " />

      <div className="flex divide-x divide-gray-800">
        {OPTIONS.map((option, id) => {
          if (!option) return null;
          return (
            <div
              className="group px-[0.5rem] pb-[0.2rem] pt-[0.5rem] hover:cursor-pointer"
              key={id}
              onClick={option.onClick}
            >
              <CustomTooltip content={option.tooltip}>
                <option.icon className="h-5 w-5 text-gray-300 group-hover:text-gray-50" />
              </CustomTooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const HighlightedTextPopup = ({
  id,
  deleteHighlight,
  hideTip,
}: {
  id: string;
  deleteHighlight: any;
  hideTip: () => void;
}) => {
  const OPTIONS = [
    {
      onClick: () => {
        deleteHighlight(id);
        hideTip();
      },
      icon: TrashIcon,
    },
  ];

  return (
    <div className="relative rounded-md bg-black">
      <div className="absolute -bottom-[10px] left-[50%] h-0 w-0 -translate-x-[50%] border-l-[10px] border-r-[10px] border-t-[10px] border-solid border-black border-l-transparent border-r-transparent " />

      <div className="flex divide-x divide-gray-800">
        {OPTIONS.map((option, id) => (
          <div
            className="group p-2 hover:cursor-pointer"
            key={id}
            onClick={option.onClick}
          >
            <option.icon
              size={18}
              className="rounded-full text-gray-300 group-hover:text-gray-50"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
export default PdfReader;

interface MyHighlightContainerProps {
  editHighlight: (idToUpdate: string, edit: Partial<Highlight>) => void; // This could update highlights in the parent
}

const MyHighlightContainer = ({ editHighlight }: MyHighlightContainerProps) => {
  const {
    highlight, // The highlight being rendred
    viewportToScaled, // Convert a highlight position to platform agnostic coords (useful for saving edits)
    screenshot, // Screenshot a bounding rectangle
    isScrolledTo, // Whether the highlight has been auto-scrolled to
    highlightBindings, // Whether the highlight has been auto-scrolled to
  } = useHighlightContainerContext();

  // const { currentTip,  } =
  //   useTipViewerUtils();

  const { toggleEditInProgress, setTip, isEditInProgress } =
    usePdfHighlighterContext();

  const isTextHighlight = !Boolean(
    highlight.content && highlight.content.image,
  );

  const component = isTextHighlight ? (
    <TextHighlight isScrolledTo={isScrolledTo} highlight={highlight} />
  ) : (
    <AreaHighlight
      isScrolledTo={isScrolledTo}
      highlight={highlight}
      onChange={(boundingRect) => {
        const edit = {
          position: {
            boundingRect: viewportToScaled(boundingRect),
            rects: [],
          },
          content: {
            image: screenshot(boundingRect),
          },
        };

        // @ts-ignore
        editHighlight(highlight.id, edit);
        toggleEditInProgress(false);
      }}
      bounds={highlightBindings.textLayer}
      onEditStart={() => toggleEditInProgress(true)}
    />
  );

  return component;
};

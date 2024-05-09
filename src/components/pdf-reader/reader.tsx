import { SpinnerPage } from "@/components/ui/spinner";
import { CustomTooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { useChatStore } from "@/lib/store";
import { copyTextToClipboard } from "@/lib/utils";
import { AppRouter } from "@/server/api/root";
import { HighlightPositionType } from "@/types/highlight";
import { HighlightTypeEnum } from "@prisma/client";
import { inferRouterOutputs } from "@trpc/server";
import {
  BookOpenCheck,
  ClipboardCopy,
  Highlighter,
  Lightbulb,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/router";
import {
  AreaHighlight,
  Highlight,
  PdfHighlighter,
  PdfLoader,
  Popup,
} from "react-pdf-highlighter";

const parseIdFromHash = () => document.location.hash.slice(1);

const resetHash = () => {
  document.location.hash = "";
};

type RouterOutput = inferRouterOutputs<AppRouter>;
type HighlightType =
  RouterOutput["document"]["getDocData"]["highlights"][number];

interface AddHighlighType {
  content: {
    text?: string;
    image?: string;
  };
  position: HighlightPositionType;
}

const PdfReader = ({
  docUrl,
  getHighlightById,
  addHighlight,
  deleteHighlight,
  highlights,
  docId,
}: {
  docId: string;
  docUrl: string;
  getHighlightById: (id: string) => HighlightType | undefined;
  addHighlight: ({ content, position }: AddHighlighType) => Promise<void>;
  deleteHighlight: (id: string) => void;
  highlights: HighlightType[];
}) => {
  const utils = api.useContext();

  const { mutate: updateAreaHighlight } =
    api.highlight.updateAreaHighlight.useMutation({
      async onMutate(newHighlight) {
        await utils.document.getDocData.cancel();
        const prevData = utils.document.getDocData.getData();

        // @ts-ignore
        utils.document.getDocData.setData({ docId: docId as string }, (old) => {
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
        toast({
          title: "Error",
          description: "Something went wrong",
          variant: "destructive",
          duration: 3000,
        });
        utils.document.getDocData.setData(
          { docId: docId as string },
          ctx?.prevData,
        );
      },
      onSettled() {
        utils.document.getDocData.invalidate();
      },
    });

  let scrollViewerTo = (highlight: any) => {};

  const scrollToHighlightFromHash = () => {
    const highlight = getHighlightById(parseIdFromHash());

    if (highlight) {
      scrollViewerTo(highlight);
    }
  };

  const { sendMessage } = useChatStore();

  return (
    <PdfLoader url={docUrl} beforeLoad={<SpinnerPage />}>
      {(pdfDocument) => (
        <PdfHighlighter
          pdfDocument={pdfDocument}
          enableAreaSelection={(event) => event.altKey}
          onScrollChange={resetHash}
          // pdfScaleValue="page-width"
          scrollRef={(scrollTo) => {
            scrollViewerTo = scrollTo;
            scrollToHighlightFromHash();
          }}
          onSelectionFinished={(
            position,
            content,
            hideTipAndSelection,
            transformSelection,
          ) => {
            return (
              <TextSelectionPopover
                sendMessage={sendMessage}
                content={content}
                hideTipAndSelection={hideTipAndSelection}
                position={position}
                addHighlight={() => addHighlight({ content, position })}
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
                      documentId: docId as string,
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
                  <HighlightedTextPopup
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
              className="group px-[0.3rem] pt-[0.3rem] hover:cursor-pointer"
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

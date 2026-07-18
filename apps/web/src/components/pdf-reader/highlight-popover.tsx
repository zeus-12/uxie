import { READING_MODE } from "@/components/pdf-reader/constants";
import { CustomTooltip } from "@/components/ui/tooltip";
import { copyTextToClipboard } from "@/lib/utils";
import { AskAiMenu } from "@uxie/shared/components/pdf-reader/ask-ai-menu";
import {
  AudioLines,
  ClipboardCopy,
  Highlighter,
  Sparkles,
  TrashIcon,
} from "lucide-react";
import { useSidebarTabStore } from "@uxie/shared/lib/store";
import { useState, type RefObject } from "react";

export const TextSelectionPopover = ({
  content,
  hideTipAndSelection,
  position,
  addHighlight,
  sendMessage,
  showAiFeatures,
  readSelectedText,
  selectionInfoRef,
  transformSelection,
}: {
  position: any;
  // Paints a persistent ghost highlight so the selection stays visible once the
  // AI input steals focus and collapses the native selection.
  transformSelection: () => void;
  addHighlight: () => void;
  content: {
    text?: string | undefined;
    image?: string | undefined;
  };
  hideTipAndSelection: () => void;
  sendMessage: ((message: string) => void) | null;
  showAiFeatures: boolean;
  readSelectedText: (args: {
    text?: string;
    readingSpeed?: number;
    continueReadingFromLastPosition?: boolean;
    readingMode: READING_MODE;
    selectionBlockIndex?: number;
    selectionOffsetInBlock?: number;
    selectionPageNumber?: number;
  }) => Promise<void>;
  selectionInfoRef: RefObject<{
    blockIndex: number;
    offsetInBlock: number;
    pageNumber: number;
  } | null>;
}) => {
  const setSidebarTab = useSidebarTabStore((s) => s.setTab);
  const isTextHighlight = content.text !== undefined;
  const [mode, setMode] = useState<"actions" | "ai">("actions");

  const switchSidebarTabToChat = () => setSidebarTab("chat");

  if (mode === "ai" && sendMessage) {
    return (
      <AskAiMenu
        selection={content.text ?? ""}
        onSubmit={(prompt) => {
          sendMessage(prompt);
          switchSidebarTabToChat();
          hideTipAndSelection();
        }}
        onClose={() => setMode("actions")}
      />
    );
  }

  const OPTIONS = [
    isTextHighlight && {
      onClick: () => {
        copyTextToClipboard(content.text, hideTipAndSelection);
        hideTipAndSelection();
      },
      icon: ClipboardCopy,
      tooltip: "Copy the text",
    },
    isTextHighlight && {
      onClick: () => {
        const info = selectionInfoRef.current;

        readSelectedText({
          text: content.text,
          readingMode: READING_MODE.TEXT,
          selectionBlockIndex: info?.blockIndex,
          selectionOffsetInBlock: info?.offsetInBlock,
          selectionPageNumber: info?.pageNumber,
        });
        hideTipAndSelection();
      },
      icon: AudioLines,
      tooltip: "Read the text",
    },
    {
      onClick: () => {
        addHighlight();
        hideTipAndSelection();
      },
      icon: Highlighter,
      tooltip: "Highlight",
    },
    showAiFeatures &&
      sendMessage && {
        onClick: () => {
          transformSelection();
          setMode("ai");
        },
        icon: Sparkles,
        tooltip: "Ask AI",
        accent: true,
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
                <option.icon
                  className={
                    "accent" in option && option.accent
                      ? "h-5 w-5 text-violet-400 group-hover:text-violet-300"
                      : "h-5 w-5 text-gray-300 group-hover:text-gray-50"
                  }
                />
              </CustomTooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const HighlightedTextPopover = ({
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

    // {
    //   onClick: () => {
    //     copyTextToClipboard(content.text, hideTipAndSelection);
    //     hideTipAndSelection();
    //   },
    //   icon: ClipboardCopy,
    //   tooltip: "Copy the text",
    // },
    // isTextHighlight && {
    //   onClick: () => {
    //     readSelectedText({ text: content.text });
    //   },
    //   icon: AudioLines,
    //   tooltip: "Read the text",
    // },
  ];

  return (
    <div className="relative rounded-md bg-black">
      <div className="absolute -bottom-[10px] left-[50%] h-0 w-0 -translate-x-[50%] border-l-[10px] border-r-[10px] border-t-[10px] border-solid border-black border-l-transparent border-r-transparent " />

      <div className="flex divide-x divide-gray-800">
        {OPTIONS.map((option, id) => {
          if (!option) return null;

          return (
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
          );
        })}
      </div>
    </div>
  );
};

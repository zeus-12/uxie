import { READING_MODE } from "@/components/pdf-reader/constants";
import { CustomTooltip } from "@/components/ui/tooltip";
import { copyTextToClipboard } from "@/lib/utils";
import {
  AudioLines,
  BookOpenCheck,
  ClipboardCopy,
  Highlighter,
  Lightbulb,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/router";

export const TextSelectionPopover = ({
  content,
  hideTipAndSelection,
  position,
  addHighlight,
  sendMessage,
  showAiFeatures,
  readSelectedText,
}: {
  position: any;
  addHighlight: () => void;
  content: {
    text?: string | undefined;
    image?: string | undefined;
  };
  hideTipAndSelection: () => void;
  sendMessage: ((message: string) => void) | null;
  showAiFeatures: boolean;
  readSelectedText: ({
    text,
    readingSpeed,
    continueReadingFromLastPosition,
    readingMode,
  }: {
    text?: string;
    readingSpeed?: number;
    continueReadingFromLastPosition?: boolean;
    readingMode: READING_MODE;
  }) => Promise<void>;
}) => {
  const router = useRouter();
  const isTextHighlight = content.text !== undefined;

  const switchSidebarTabToChat = () => {
    router.push({
      query: {
        ...router.query,
        tab: "chat",
      },
    });
  };

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
        readSelectedText({
          text: content.text,
          readingMode: READING_MODE.TEXT,
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
          // dont show this in clients chat- instead create some "summarise-template" which simply shows "summarise" and then the message, prob need to change the data model for this
          sendMessage(
            "**Explain the following text in simple terms**: \n'" +
              content.text +
              "'",
          );
          switchSidebarTabToChat();
          hideTipAndSelection();
        },
        icon: Lightbulb,
        tooltip: "Explain the text",
      },
    showAiFeatures &&
      sendMessage && {
        onClick: () => {
          // dont show this in clients chat- instead create some "summarise-template" which simply shows "summarise" and then the message, prob need to change the data model for this
          sendMessage(
            "**Summarise the following text in simple terms**: \n'" +
              content.text +
              "'",
          );
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

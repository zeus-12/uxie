import { useState } from "react";
import { READING_MODE } from "./constants";
import { CustomTooltip } from "../ui/tooltip";
import { copyTextToClipboard } from "../../lib/utils";
import { AskAiMenu } from "./ask-ai-menu";
import {
  AudioLines,
  ClipboardCopy,
  Highlighter,
  Sparkles,
  TrashIcon,
} from "lucide-react";

type ReadSelectedText = (args: {
  text?: string;
  readingMode: READING_MODE;
}) => Promise<void>;

export const TextSelectionPopover = ({
  content,
  hideTipAndSelection,
  addHighlight,
  sendMessage,
  showAiFeatures,
  readSelectedText,
  transformSelection,
}: {
  content: { text?: string; image?: string };
  hideTipAndSelection: () => void;
  addHighlight: () => void;
  sendMessage?: ((message: string) => void) | null;
  showAiFeatures?: boolean;
  readSelectedText?: ReadSelectedText;
  // Paints a persistent ghost highlight so the selection stays visible once the
  // AI input steals focus and collapses the native selection.
  transformSelection?: () => void;
}) => {
  const isTextHighlight = content.text !== undefined;
  const [mode, setMode] = useState<"actions" | "ai">("actions");

  if (mode === "ai" && sendMessage) {
    return (
      <AskAiMenu
        selection={content.text ?? ""}
        onSubmit={(prompt) => {
          sendMessage(prompt);
          hideTipAndSelection();
        }}
        onClose={() => setMode("actions")}
      />
    );
  }

  const OPTIONS = [
    isTextHighlight && {
      onClick: () => {
        if (content.text) void copyTextToClipboard(content.text);
        hideTipAndSelection();
      },
      icon: ClipboardCopy,
      tooltip: "Copy the text",
    },
    isTextHighlight &&
      readSelectedText && {
        onClick: () => {
          void readSelectedText({
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
          transformSelection?.();
          setMode("ai");
        },
        icon: Sparkles,
        tooltip: "Ask AI",
        accent: true,
      },
  ].filter(Boolean);

  return (
    <div className="relative rounded-md bg-black">
      <div className="absolute -bottom-[7px] left-[50%] h-0 w-0 -translate-x-[50%] border-l-[7px] border-r-[7px] border-t-[7px] border-solid border-black border-l-transparent border-r-transparent" />

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
  deleteHighlight: (id: string) => void;
  hideTip: () => void;
}) => {
  return (
    <div className="relative rounded-md bg-black">
      <div className="absolute -bottom-[10px] left-[50%] h-0 w-0 -translate-x-[50%] border-l-[10px] border-r-[10px] border-t-[10px] border-solid border-black border-l-transparent border-r-transparent" />

      <div className="flex divide-x divide-gray-800">
        <div
          className="group p-2 hover:cursor-pointer"
          onClick={() => {
            deleteHighlight(id);
            hideTip();
          }}
        >
          <TrashIcon
            size={18}
            className="rounded-full text-gray-300 group-hover:text-gray-50"
          />
        </div>
      </div>
    </div>
  );
};

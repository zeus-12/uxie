import { READING_MODE } from "./constants";
import { CustomTooltip } from "../ui/tooltip";
import { copyTextToClipboard } from "../../lib/utils";
import { AskAiMenu } from "./ask-ai-menu";
import {
  AudioLines,
  ClipboardCopy,
  Highlighter,
  MessageSquarePlus,
  Sparkles,
  TrashIcon,
} from "lucide-react";
import { useChatStore, useSidebarTabStore } from "../../lib/store";
import { useState, type RefObject } from "react";

/**
 * Where in the text layer a selection started — lets "Read the text" resume
 * from the exact word rather than the top of the selection.
 */
export type SelectionInfo = {
  blockIndex: number;
  offsetInBlock: number;
  pageNumber: number;
};

export type ReadSelectedText = (args: {
  text?: string;
  readingSpeed?: number;
  continueReadingFromLastPosition?: boolean;
  readingMode: READING_MODE;
  selectionBlockIndex?: number;
  selectionOffsetInBlock?: number;
  selectionPageNumber?: number;
}) => Promise<void>;

export const TextSelectionPopover = ({
  content,
  hideTipAndSelection,
  addHighlight,
  sendMessage,
  stageImageAttachment,
  showAiFeatures,
  readSelectedText,
  selectionInfoRef,
  transformSelection,
}: {
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
  stageImageAttachment: ((dataUrl: string) => void) | null;
  showAiFeatures: boolean;
  readSelectedText: ReadSelectedText;
  selectionInfoRef: RefObject<SelectionInfo | null>;
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
        if (content.text) void copyTextToClipboard(content.text);
        hideTipAndSelection();
      },
      icon: ClipboardCopy,
      tooltip: "Copy the text",
    },
    isTextHighlight && {
      onClick: () => {
        const info = selectionInfoRef.current;

        void readSelectedText({
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
    !isTextHighlight &&
      content.image &&
      stageImageAttachment && {
        onClick: () => {
          stageImageAttachment(content.image ?? "");
          switchSidebarTabToChat();
          hideTipAndSelection();
          useChatStore.getState().focusInput?.();
        },
        icon: MessageSquarePlus,
        tooltip: "Attach to chat",
      },
    isTextHighlight &&
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
    <div className="rounded-lg border bg-popover shadow-[0_4px_16px_-4px_rgb(0_0_0/0.25)]">
      <div className="flex divide-x divide-border">
        {OPTIONS.map((option, id) => {
          if (!option) return null;
          return (
            <CustomTooltip content={option.tooltip} asChild key={id}>
              <button
                type="button"
                aria-label={option.tooltip}
                className="group px-2 pb-[0.2rem] pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={option.onClick}
              >
                <option.icon
                  className={
                    "accent" in option && option.accent
                      ? "h-5 w-5 text-primary group-hover:opacity-80"
                      : "h-5 w-5 text-muted-foreground group-hover:text-foreground"
                  }
                />
              </button>
            </CustomTooltip>
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
    <div className="rounded-lg border bg-popover shadow-[0_4px_16px_-4px_rgb(0_0_0/0.25)]">
      <div className="flex divide-x divide-border">
        <button
          type="button"
          aria-label="Delete highlight"
          className="group p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => {
            deleteHighlight(id);
            hideTip();
          }}
        >
          <TrashIcon
            size={18}
            className="rounded-full text-muted-foreground group-hover:text-danger"
          />
        </button>
      </div>
    </div>
  );
};

import { AskAiMenu } from "@uxie/shared/components/pdf-reader/ask-ai-menu";
import { Button } from "@uxie/shared/components/ui/button";
import { CustomTooltip } from "@uxie/shared/components/ui/tooltip";
import {
  AudioLinesIcon,
  ClipboardCopyIcon,
  HighlighterIcon,
  SparklesIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";

type ActionProps = {
  rect: DOMRect;
  text: string;
  onDismiss: () => void;
};

const positionFor = (rect: DOMRect, halfWidth = 84) => ({
  left: Math.min(
    window.innerWidth - halfWidth - 8,
    Math.max(halfWidth + 8, rect.left + rect.width / 2),
  ),
  top: Math.max(48, rect.top - 8),
});

const actionButtonClass =
  "h-8 w-9 rounded-none px-0 text-gray-300 hover:bg-gray-900 hover:text-gray-50";

export function ArticleSelectionPopover({
  rect,
  text,
  canEdit,
  onDismiss,
  onHighlight,
  onRead,
  onAsk,
}: ActionProps & {
  canEdit: boolean;
  onHighlight: () => void;
  onRead?: () => void;
  onAsk?: (prompt: string) => void;
}) {
  const [mode, setMode] = useState<"actions" | "ai">("actions");
  const position = positionFor(rect);

  if (mode === "ai" && onAsk) {
    return (
      <div
        className="fixed z-[70] -translate-x-1/2 -translate-y-full"
        style={positionFor(rect, 160)}
        role="dialog"
        aria-label="Ask AI about selected text"
      >
        <AskAiMenu
          selection={text}
          onSubmit={(prompt) => {
            onAsk(prompt);
            onDismiss();
          }}
          onClose={() => setMode("actions")}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed z-[70] -translate-x-1/2 -translate-y-full rounded-md bg-black shadow-xl"
      style={position}
      role="toolbar"
      aria-label="Selected text actions"
    >
      <div className="absolute -bottom-[7px] left-1/2 h-0 w-0 -translate-x-1/2 border-l-[7px] border-r-[7px] border-t-[7px] border-solid border-black border-l-transparent border-r-transparent" />
      <div className="flex divide-x divide-gray-800 overflow-hidden rounded-md">
        <CustomTooltip content="Copy the text" asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={actionButtonClass}
            aria-label="Copy selected text"
            onClick={() => {
              void navigator.clipboard.writeText(text);
              onDismiss();
            }}
          >
            <ClipboardCopyIcon aria-hidden="true" className="h-5 w-5" />
          </Button>
        </CustomTooltip>
        {onRead && (
          <CustomTooltip content="Read the text" asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={actionButtonClass}
              aria-label="Read from selected text"
              onClick={() => {
                onRead();
                onDismiss();
              }}
            >
              <AudioLinesIcon aria-hidden="true" className="h-5 w-5" />
            </Button>
          </CustomTooltip>
        )}
        {canEdit && (
          <CustomTooltip content="Highlight" asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={actionButtonClass}
              aria-label="Highlight selected text"
              onClick={onHighlight}
            >
              <HighlighterIcon aria-hidden="true" className="h-5 w-5" />
            </Button>
          </CustomTooltip>
        )}
        {onAsk && (
          <CustomTooltip content="Ask AI" asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-9 rounded-none px-0 text-violet-400 hover:bg-gray-900 hover:text-violet-300"
              aria-label="Ask AI about selected text"
              onClick={() => setMode("ai")}
            >
              <SparklesIcon aria-hidden="true" className="h-5 w-5" />
            </Button>
          </CustomTooltip>
        )}
      </div>
    </div>
  );
}

export function ArticleHighlightPopover({
  rect,
  text,
  onDismiss,
  onDelete,
}: ActionProps & { onDelete: () => void }) {
  return (
    <div
      className="fixed z-[70] -translate-x-1/2 -translate-y-full rounded-md bg-black shadow-xl"
      style={positionFor(rect)}
      role="toolbar"
      aria-label={`Actions for highlighted text: ${text}`}
    >
      <div className="absolute -bottom-[7px] left-1/2 h-0 w-0 -translate-x-1/2 border-l-[7px] border-r-[7px] border-t-[7px] border-solid border-black border-l-transparent border-r-transparent" />
      <CustomTooltip content="Delete highlight" asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={actionButtonClass}
          aria-label="Delete highlight"
          onClick={() => {
            onDelete();
            onDismiss();
          }}
        >
          <TrashIcon aria-hidden="true" className="h-5 w-5" />
        </Button>
      </CustomTooltip>
    </div>
  );
}

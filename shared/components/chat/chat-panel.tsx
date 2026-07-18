import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowUpIcon, Loader2Icon, SearchIcon, SquareIcon } from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { cn } from "../../lib/utils";
import { ShimmeringText } from "../ui/shimmering-text";

export type ChatRole = "user" | "assistant";

// A flat, render-agnostic view of the conversation. Both apps translate their
// native state (desktop: streamText state; web: useChat `parts`) into this, so
// the whole chat surface looks identical regardless of the data layer.
export type ChatRow =
  | { kind: "message"; role: ChatRole; content: string }
  | { kind: "streaming"; content: string }
  | { kind: "tool"; label: string; active: boolean }
  | { kind: "thinking"; label: string }
  | { kind: "error"; content: string };

interface ChatPanelProps {
  rows: ChatRow[];
  /** Gate the list until history has loaded so it can start pinned to bottom. */
  loaded: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  streaming: boolean;
  placeholder?: string;
  /** Each app supplies its own markdown renderer (avoids a shared dep). */
  renderMarkdown: (text: string) => ReactNode;
  /** Focused by the ⌘L shortcut / on switching to the chat tab. */
  inputRef?: RefObject<HTMLTextAreaElement>;
}

export function ChatPanel({
  rows,
  loaded,
  input,
  onInputChange,
  onSubmit,
  onStop,
  streaming,
  placeholder = "Ask about this document…",
  renderMarkdown,
  inputRef,
}: ChatPanelProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const atBottomRef = useRef(true);
  const internalTaRef = useRef<HTMLTextAreaElement>(null);
  const taRef = inputRef ?? internalTaRef;

  function grow() {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
  }

  useEffect(grow, [input, taRef]);

  // Keep newest content pinned while it grows / a turn completes, but only if
  // the user hasn't scrolled up to read history.
  useEffect(() => {
    if (atBottomRef.current) {
      virtuosoRef.current?.scrollToIndex({ index: "LAST", align: "end" });
    }
  }, [rows.length, rows[rows.length - 1]]);

  return (
    <div className="flex h-full flex-col">
      {loaded ? (
        <Virtuoso
          ref={virtuosoRef}
          className="uxie-chat-scroll flex-1"
          data={rows}
          alignToBottom
          initialTopMostItemIndex={Math.max(0, rows.length - 1)}
          followOutput={(atBottom) => (atBottom ? "auto" : false)}
          atBottomStateChange={(atBottom) => (atBottomRef.current = atBottom)}
          increaseViewportBy={{ top: 600, bottom: 200 }}
          components={{ Header: () => <div className="h-3" /> }}
          itemContent={(_, row) => (
            <RowView row={row} renderMarkdown={renderMarkdown} />
          )}
        />
      ) : (
        <div className="flex-1" />
      )}

      <div className="p-2">
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-muted/60 py-2 pl-3.5 pr-2 focus-within:border-ring">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => {
              onInputChange(e.target.value);
              grow();
            }}
            onKeyDown={(e) => {
              const cmdEnter = (e.metaKey || e.ctrlKey) && e.key === "Enter";
              if (cmdEnter || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                onSubmit();
              }
            }}
            rows={2}
            placeholder={placeholder}
            className="max-h-40 min-h-[3.25rem] flex-1 resize-none self-stretch bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => (streaming && onStop ? onStop() : onSubmit())}
            disabled={!streaming && !input.trim()}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white transition-opacity disabled:opacity-40"
            aria-label={streaming && onStop ? "Stop" : "Send"}
          >
            {streaming ? (
              onStop ? (
                <SquareIcon className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              )
            ) : (
              <ArrowUpIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function RowView({
  row,
  renderMarkdown,
}: {
  row: ChatRow;
  renderMarkdown: (text: string) => ReactNode;
}) {
  return (
    <div className="px-2 pb-4">
      {row.kind === "message" ? (
        <ChatBubble
          role={row.role}
          content={row.content}
          renderMarkdown={renderMarkdown}
        />
      ) : row.kind === "streaming" ? (
        <ChatBubble
          role="assistant"
          content={row.content}
          renderMarkdown={renderMarkdown}
        />
      ) : row.kind === "tool" ? (
        <ToolChip label={row.label} active={row.active} />
      ) : row.kind === "thinking" ? (
        <ShimmeringText text={row.label} startOnView={false} className="px-1 text-sm" />
      ) : (
        <p className="px-1 text-sm text-destructive">{row.content}</p>
      )}
    </div>
  );
}

// ChatGPT-style: tool activity lives OUTSIDE the bubble, on its own line.
function ToolChip({ label, active }: { label: string; active: boolean }) {
  if (active) {
    return <ShimmeringText text={label} startOnView={false} className="px-1 text-sm" />;
  }
  return (
    <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
      <SearchIcon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

function ChatBubble({
  role,
  content,
  renderMarkdown,
}: {
  role: ChatRole;
  content: string;
  renderMarkdown: (text: string) => ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      {isUser ? (
        <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl bg-blue-500 px-3.5 py-2 text-sm text-white">
          {content}
        </div>
      ) : (
        <div className="prose prose-sm max-w-none rounded-2xl bg-muted px-3.5 py-2 text-foreground prose-p:my-1.5 prose-pre:my-2 prose-headings:mt-2 prose-headings:mb-1">
          {renderMarkdown(content)}
        </div>
      )}
    </div>
  );
}

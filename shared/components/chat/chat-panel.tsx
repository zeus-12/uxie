import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowUpIcon,
  Loader2Icon,
  PaperclipIcon,
  SearchIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { ChatImageAttachment } from "../../lib/chat-attachments";
import { cn } from "../../lib/utils";
import { ShimmeringText } from "../ui/shimmering-text";

export type ChatRole = "user" | "assistant";

// A flat, render-agnostic view of the conversation. Both apps translate their
// native state (desktop: streamText state; web: useChat `parts`) into this, so
// the whole chat surface looks identical regardless of the data layer.
export type ChatRow =
  | {
      kind: "message";
      role: ChatRole;
      content: string;
      attachments?: ChatImageAttachment[];
    }
  | { kind: "streaming"; content: string }
  | { kind: "tool"; label: string; active: boolean }
  | { kind: "thinking"; label: string }
  | { kind: "error"; content: string };

interface ChatPanelProps {
  rows: ChatRow[];
  /** Gate the list until history has loaded so it can start pinned to bottom. */
  loaded: boolean;
  input: string;
  attachments: ChatImageAttachment[];
  attachmentError?: string | null;
  onInputChange: (value: string) => void;
  onFilesSelected: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
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
  attachments,
  attachmentError,
  onInputChange,
  onFilesSelected,
  onRemoveAttachment,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taRef = inputRef ?? internalTaRef;
  const [dragActive, setDragActive] = useState(false);

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
        <div
          className={cn(
            "rounded-2xl border border-input bg-muted/60 transition-colors focus-within:border-blue-400",
            dragActive && "border-blue-500 bg-blue-50/70",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            const relatedTarget = event.relatedTarget;
            if (
              !(relatedTarget instanceof Node) ||
              !event.currentTarget.contains(relatedTarget)
            ) {
              setDragActive(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            onFilesSelected(Array.from(event.dataTransfer.files));
          }}
        >
          {attachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-2 pb-0 pt-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-background shadow-sm"
                >
                  <img
                    src={attachment.url}
                    alt={attachment.filename}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(attachment.id)}
                    aria-label={`Remove ${attachment.filename}`}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white opacity-90 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <XIcon className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-1.5 p-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                onFilesSelected(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach images"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <PaperclipIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => {
                onInputChange(e.target.value);
                grow();
              }}
              onPaste={(event) => {
                const files = Array.from(event.clipboardData.files);
                if (!files.length) return;
                event.preventDefault();
                onFilesSelected(files);
              }}
              onKeyDown={(e) => {
                const cmdEnter = (e.metaKey || e.ctrlKey) && e.key === "Enter";
                if (cmdEnter || (e.key === "Enter" && !e.shiftKey)) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              rows={1}
              placeholder={placeholder}
              className="max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm leading-5 outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => (streaming && onStop ? onStop() : onSubmit())}
              disabled={!streaming && !input.trim() && !attachments.length}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-40"
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
          {attachmentError && (
            <p role="alert" className="px-3 pb-2 text-xs text-destructive">
              {attachmentError}
            </p>
          )}
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
          attachments={row.attachments}
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
        <ShimmeringText
          text={row.label}
          startOnView={false}
          className="px-1 text-sm"
        />
      ) : (
        <p className="px-1 text-sm text-destructive">{row.content}</p>
      )}
    </div>
  );
}

// ChatGPT-style: tool activity lives OUTSIDE the bubble, on its own line.
function ToolChip({ label, active }: { label: string; active: boolean }) {
  if (active) {
    return (
      <ShimmeringText
        text={label}
        startOnView={false}
        className="px-1 text-sm"
      />
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-1 text-sm text-muted-foreground">
      <SearchIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      <span>{label}</span>
    </div>
  );
}

function ChatBubble({
  role,
  content,
  attachments = [],
  renderMarkdown,
}: {
  role: ChatRole;
  content: string;
  attachments?: ChatImageAttachment[];
  renderMarkdown: (text: string) => ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      {isUser ? (
        <div className="ml-auto flex max-w-[85%] flex-col items-end gap-1.5">
          <AttachmentGallery attachments={attachments} />
          {content && (
            <div className="w-fit whitespace-pre-wrap rounded-2xl bg-blue-500 px-3.5 py-2 text-sm leading-5 text-white">
              {content}
            </div>
          )}
        </div>
      ) : (
        <div className="flex max-w-[85%] flex-col items-start gap-1.5">
          <AttachmentGallery attachments={attachments} />
          {content && (
            <div className="prose prose-sm max-w-none rounded-2xl bg-muted px-3.5 py-2 text-sm leading-5 text-foreground prose-p:my-0 prose-p:leading-5 prose-pre:my-2 prose-headings:mb-1 prose-headings:mt-2 [&_p+p]:mt-2">
              {renderMarkdown(content)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AttachmentGallery({
  attachments,
}: {
  attachments: ChatImageAttachment[];
}) {
  if (!attachments.length) return null;

  return (
    <div
      className={cn(
        "grid max-w-full gap-1 overflow-hidden rounded-2xl border border-border bg-muted p-1 shadow-sm",
        attachments.length > 1 ? "grid-cols-2" : "grid-cols-1",
      )}
    >
      {attachments.map((attachment, index) => (
        <img
          key={attachment.id}
          src={attachment.url}
          alt={attachment.filename}
          className={cn(
            "block bg-background object-cover",
            attachments.length === 1
              ? "max-h-64 min-h-32 max-w-full rounded-xl"
              : "aspect-square min-w-0 rounded-lg",
            attachments.length === 3 &&
              index === 2 &&
              "col-span-2 aspect-[2/1]",
          )}
        />
      ))}
    </div>
  );
}

import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowUpIcon,
  ImagePlusIcon,
  Loader2Icon,
  SearchIcon,
  SquareIcon,
} from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { toast } from "sonner";
import type { CitationIndex, RetrievedChunk } from "../../lib/chat";
import {
  CITATION_GROUP_TAG,
  remarkCitations,
  withoutPartialCitation,
} from "../../lib/citation-markdown";
import type { ChatRole, ChatRow } from "../../lib/chat-rows";
import {
  useCitationHighlightStore,
  useMobileSidebarStore,
} from "../../lib/store";
import type { ChatImage } from "../../lib/chat-attachments";
import { cn } from "../../lib/utils";
import { ShimmeringText } from "../ui/shimmering-text";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  ImageLightbox,
  MessageImageGrid,
  StagedImageStrip,
} from "./chat-images";

export type { ChatRole, ChatRow } from "../../lib/chat-rows";

export type MarkdownCitations = {
  remarkPlugins: ReturnType<typeof remarkCitations>[];
  components: {
    [CITATION_GROUP_TAG]: typeof CitationGroupTag;
  };
};
export type RenderMarkdown = (
  text: string,
  citations?: MarkdownCitations,
) => ReactNode;

interface ChatPanelProps {
  rows: ChatRow[];
  /** Gate the list until history has loaded so it can start pinned to bottom. */
  loaded: boolean;
  input: string;
  attachments: ChatImage[];
  attachmentError?: string | null;
  attachmentsPending: number;
  sending?: boolean;
  onInputChange: (value: string) => void;
  onFilesSelected: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  streaming: boolean;
  placeholder?: string;
  /** Each app supplies its own markdown renderer (avoids a shared dep). */
  renderMarkdown: RenderMarkdown;
  /** Focused by the ⌘L shortcut / on switching to the chat tab. */
  inputRef?: RefObject<HTMLTextAreaElement>;
}

export function ChatPanel({
  rows,
  loaded,
  input,
  attachments,
  attachmentError,
  attachmentsPending,
  sending = false,
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
  const dragDepthRef = useRef(0);
  const busy = sending || attachmentsPending > 0;
  const [previewImage, setPreviewImage] = useState<ChatImage | null>(null);
  const canSend =
    !streaming && !busy && (!!input.trim() || attachments.length > 0);
  const submitIfReady = () => {
    if (canSend) onSubmit();
  };

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
            <RowView
              row={row}
              renderMarkdown={renderMarkdown}
              onOpenImage={setPreviewImage}
            />
          )}
        />
      ) : (
        <div className="flex-1" />
      )}

      <div className="p-2">
        <div
          className={cn(
            "rounded-2xl border border-input bg-muted/60 transition-colors focus-within:border-ring",
            dragActive && "border-primary bg-primary/10",
          )}
          onDragEnter={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            dragDepthRef.current += 1;
            setDragActive(true);
          }}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("Files"))
              event.preventDefault();
          }}
          onDragLeave={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (dragDepthRef.current === 0) setDragActive(false);
          }}
          onDrop={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            dragDepthRef.current = 0;
            setDragActive(false);
            onFilesSelected(Array.from(event.dataTransfer.files));
          }}
        >
          <StagedImageStrip
            images={attachments}
            pending={attachmentsPending}
            onOpen={setPreviewImage}
            onRemove={onRemoveAttachment}
            locked={sending}
          />

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
              title="Attach images"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ImagePlusIcon className="size-4" aria-hidden="true" />
            </button>
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => {
                onInputChange(e.target.value);
                grow();
              }}
              readOnly={sending}
              onPaste={(event) => {
                const images = Array.from(event.clipboardData.files).filter(
                  (file) => file.type.startsWith("image/"),
                );
                if (images.length) onFilesSelected(images);
              }}
              onKeyDown={(e) => {
                const cmdEnter = (e.metaKey || e.ctrlKey) && e.key === "Enter";
                if (cmdEnter || (e.key === "Enter" && !e.shiftKey)) {
                  e.preventDefault();
                  submitIfReady();
                }
              }}
              rows={1}
              placeholder={placeholder}
              className="max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm leading-5 outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => (streaming && onStop ? onStop() : submitIfReady())}
              disabled={!streaming && !canSend}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:bg-muted disabled:text-muted-foreground"
              aria-label={streaming && onStop ? "Stop" : "Send"}
            >
              {streaming ? (
                onStop ? (
                  <SquareIcon className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                )
              ) : busy ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
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
      <ImageLightbox
        image={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}

function RowView({
  row,
  renderMarkdown,
  onOpenImage,
}: {
  row: ChatRow;
  renderMarkdown: RenderMarkdown;
  onOpenImage: (image: ChatImage) => void;
}) {
  return (
    <div className="px-2 pb-4">
      {row.kind === "message" ? (
        <ChatBubble
          role={row.role}
          content={row.content}
          citations={row.citations}
          attachments={row.attachments}
          renderMarkdown={renderMarkdown}
          onOpenImage={onOpenImage}
        />
      ) : row.kind === "streaming" ? (
        <ChatBubble
          role="assistant"
          content={withoutPartialCitation(row.content)}
          citations={row.citations}
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
  citations,
  attachments = [],
  renderMarkdown,
  onOpenImage,
}: {
  role: ChatRole;
  content: string;
  citations?: CitationIndex;
  attachments?: ChatImage[];
  renderMarkdown: RenderMarkdown;
  onOpenImage?: (image: ChatImage) => void;
}) {
  const isUser = role === "user";
  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      {isUser ? (
        <div className="ml-auto flex max-w-[85%] flex-col items-end gap-1.5">
          {onOpenImage && (
            <MessageImageGrid images={attachments} onOpen={onOpenImage} />
          )}
          {content && (
            <div className="w-fit whitespace-pre-wrap rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
              {content}
            </div>
          )}
        </div>
      ) : (
        <div className="prose prose-sm max-w-full rounded-2xl bg-muted px-3.5 py-2 text-foreground prose-p:my-1.5 prose-pre:my-2 prose-headings:mb-1 prose-headings:mt-2">
          <CitedMarkdown
            content={content}
            citations={citations}
            renderMarkdown={renderMarkdown}
          />
        </div>
      )}
    </div>
  );
}

export function CitedMarkdown({
  content,
  citations,
  renderMarkdown,
}: {
  content: string;
  citations?: CitationIndex;
  renderMarkdown: RenderMarkdown;
}) {
  const index = citations ?? NO_CITATIONS;
  return (
    <TooltipProvider delayDuration={150}>
      <CitationContext.Provider value={index}>
        {renderMarkdown(content, {
          remarkPlugins: [remarkCitations(index)],
          components: CITATION_COMPONENTS,
        })}
      </CitationContext.Provider>
    </TooltipProvider>
  );
}

const NO_CITATIONS: CitationIndex = new Map();
const CitationContext = createContext<CitationIndex>(NO_CITATIONS);

function useOpenSource() {
  const highlightSource = useCitationHighlightStore(
    (state) => state.highlightSource,
  );
  const setDrawerOpen = useMobileSidebarStore((state) => state.setDrawerOpen);
  return (source: RetrievedChunk) => {
    setDrawerOpen(false);
    if (!highlightSource) {
      toast.error("The document is still loading", { duration: 3000 });
      return;
    }
    highlightSource(source);
  };
}

function sourceLocation(source: RetrievedChunk) {
  return source.kind === "pdf" ? `Page ${source.pageNumber}` : "Article";
}

function CitationRef({
  label,
  source,
}: {
  label: string;
  source: RetrievedChunk;
}) {
  const openSource = useOpenSource();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => openSource(source)}
          aria-label={`Source ${label}, ${sourceLocation(source)}`}
          className="rounded-sm font-medium text-info tabular-nums underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className={cn(
          "px-2 py-1 text-xs",
          source.kind === "article" && "max-w-64 leading-snug",
        )}
      >
        {source.kind === "pdf" ? (
          sourceLocation(source)
        ) : (
          <p className="line-clamp-3">{source.pageContent}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function CitationGroupTag(
  props: HTMLAttributes<HTMLElement> & { "data-refs"?: string },
) {
  const citations = useContext(CitationContext);
  const cited = (props["data-refs"] ?? "").split(",").flatMap((ref) => {
    const source = citations.get(Number(ref));
    return source ? [{ source, label: ref }] : [];
  });
  if (!cited.length) return null;
  return (
    <span className="whitespace-nowrap not-italic text-muted-foreground">
      [
      {cited.map(({ source, label }, index) => (
        <Fragment key={label}>
          {index > 0 && ", "}
          <CitationRef label={label} source={source} />
        </Fragment>
      ))}
      ]
    </span>
  );
}

const CITATION_COMPONENTS: MarkdownCitations["components"] = {
  [CITATION_GROUP_TAG]: CitationGroupTag,
};

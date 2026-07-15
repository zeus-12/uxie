import { useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { ArrowUpIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@uxie/shared/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import type { ChatMessage } from "../ipc-contract";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Chat({
  docId,
  isVectorised,
}: {
  docId: string;
  isVectorised: boolean;
}) {
  const [indexed, setIndexed] = useState(isVectorised);

  if (!indexed) {
    return <IndexGate docId={docId} onIndexed={() => setIndexed(true)} />;
  }
  return <ChatView docId={docId} />;
}

function IndexGate({
  docId,
  onIndexed,
}: {
  docId: string;
  onIndexed: () => void;
}) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function index() {
    const { vectorise } = await import("./rag");
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      await vectorise(docId, (done, total) => setProgress({ done, total }));
      onIndexed();
    } catch (e) {
      setError(message(e));
      setProgress(null);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <SparklesIcon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="font-medium">Chat with this document</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Index the PDF once (on-device) to ask questions grounded in its
          contents.
        </p>
      </div>
      {progress ? (
        <div className="flex w-56 flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            Indexing document…
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 5}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <Button onClick={index} className="rounded-full">
          <SparklesIcon className="mr-1.5 h-4 w-4" /> Index document
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function ChatView({ docId }: { docId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const streamIdRef = useRef<string | null>(null);
  const streamTextRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  function grow() {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
  }

  useEffect(() => {
    const offDelta = window.uxieAPI.onChatDelta((sid, delta) => {
      if (sid !== streamIdRef.current) return;
      streamTextRef.current += delta;
      setStreamingText(streamTextRef.current);
    });
    const offDone = window.uxieAPI.onChatDone((sid) => {
      if (sid !== streamIdRef.current) return;
      const text = streamTextRef.current;
      if (text) setMessages((m) => [...m, { role: "assistant", content: text }]);
      streamTextRef.current = "";
      setStreamingText("");
      setStreaming(false);
      streamIdRef.current = null;
    });
    const offError = window.uxieAPI.onChatError((sid, msg) => {
      if (sid !== streamIdRef.current) return;
      setError(msg);
      streamTextRef.current = "";
      setStreamingText("");
      setStreaming(false);
      streamIdRef.current = null;
    });
    return () => {
      offDelta();
      offDone();
      offError();
      if (streamIdRef.current) window.uxieAPI.cancelChat(streamIdRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.uxieAPI
      .getMessages(docId)
      .then((m) => !cancelled && setMessages(m))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [docId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingText]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setError(null);
    setStreaming(true);
    if (taRef.current) taRef.current.style.height = "auto";
    try {
      const { retrieve } = await import("./rag");
      const context = await retrieve(docId, text);
      const sid = createId();
      streamIdRef.current = sid;
      streamTextRef.current = "";
      setStreamingText("");
      window.uxieAPI.sendChat(sid, docId, history, context.join("\n\n---\n\n"));
    } catch (e) {
      setError(message(e));
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} />
        ))}
        {streamingText && <ChatBubble role="assistant" content={streamingText} />}
        {error && <p className="px-2 text-sm text-destructive">{error}</p>}
      </div>

      <div className="p-2">
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-muted/60 py-2 pl-3.5 pr-2 focus-within:border-ring">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              grow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Ask about this document…"
            className="max-h-40 min-h-[3.25rem] flex-1 resize-none self-stretch bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            aria-label="Send"
          >
            {streaming ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <Message align={isUser ? "end" : "start"}>
      <MessageContent>
        {isUser ? (
          <div className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
            {content}
          </div>
        ) : (
          <div className="prose prose-sm max-w-none rounded-2xl bg-muted px-3.5 py-2 text-foreground prose-p:my-1.5 prose-pre:my-2 prose-headings:mt-2 prose-headings:mb-1">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </MessageContent>
    </Message>
  );
}

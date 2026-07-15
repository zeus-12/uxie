import { useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { SendHorizonalIcon, SparklesIcon } from "lucide-react";
import { Button } from "@uxie/shared/components/ui/button";
import type { ChatMessage } from "../ipc-contract";
import { retrieve, vectorise } from "./rag";

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
      <SparklesIcon className="h-8 w-8 text-primary" />
      <div>
        <p className="font-medium">Chat with this document</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Index the PDF once (on-device) to ask questions grounded in its
          contents.
        </p>
      </div>
      {progress ? (
        <p className="text-sm text-muted-foreground">
          Indexing…{" "}
          {progress.total ? `${progress.done}/${progress.total} chunks` : ""}
        </p>
      ) : (
        <Button onClick={index}>Index document</Button>
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
    try {
      const context = await retrieve(docId, text);
      const sid = createId();
      streamIdRef.current = sid;
      streamTextRef.current = "";
      setStreamingText("");
      window.uxieAPI.sendChat(sid, history, context.join("\n\n---\n\n"));
    } catch (e) {
      setError(message(e));
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-1">
        {messages.length === 0 && !streamingText && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Ask about this document.
          </p>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {streamingText && <Bubble role="assistant" content={streamingText} />}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex items-end gap-2 border-t border-stone-200 p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Ask a question…"
          className="max-h-32 flex-1 resize-none rounded-md border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-300"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-50"
        >
          <SendHorizonalIcon size={16} />
        </button>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
            : "max-w-[85%] whitespace-pre-wrap rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900"
        }
      >
        {content}
      </div>
    </div>
  );
}

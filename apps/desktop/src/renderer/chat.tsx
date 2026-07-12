import { useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { SendHorizonalIcon } from "lucide-react";
import type { ChatMessage } from "../ipc-contract";

export function Chat() {
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

  function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setError(null);
    const sid = createId();
    streamIdRef.current = sid;
    streamTextRef.current = "";
    setStreamingText("");
    setStreaming(true);
    window.uxieAPI.sendChat(sid, history);
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-1">
        {messages.length === 0 && !streamingText && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Ask about this document. Uses the model set in Settings.
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

import { useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import type { ChatMessage } from "../ipc-contract";

export function Assistant({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const streamIdRef = useRef<string | null>(null);
  const streamTextRef = useRef("");

  useEffect(() => {
    const offDelta = window.uxieAPI.onChatDelta((sid, delta) => {
      if (sid !== streamIdRef.current) return;
      streamTextRef.current += delta;
      setStreamingText(streamTextRef.current);
    });
    const offDone = window.uxieAPI.onChatDone((sid) => {
      if (sid !== streamIdRef.current) return;
      const text = streamTextRef.current;
      if (text) {
        setMessages((m) => [...m, { role: "assistant", content: text }]);
      }
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
      // Stop a still-running stream in main when we leave the view.
      if (streamIdRef.current) window.uxieAPI.cancelChat(streamIdRef.current);
    };
  }, []);

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
    <div className="flex h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex items-center gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Library
        </button>
        <span className="text-sm font-medium">Assistant</span>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 && !streamingText && (
          <p className="text-sm text-zinc-500">
            Ask anything. Uses the model configured in Settings.
          </p>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {streamingText && <Bubble role="assistant" content={streamingText} />}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message…"
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          Send
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
            ? "max-w-[80%] whitespace-pre-wrap rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-white dark:text-zinc-900"
            : "max-w-[80%] whitespace-pre-wrap rounded-lg bg-zinc-200 px-3 py-2 text-sm dark:bg-zinc-800"
        }
      >
        {content}
      </div>
    </div>
  );
}

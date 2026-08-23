import { DEMO_CHAT_REPLIES, DEMO_CHAT_WELCOME } from "@/lib/demo/seed";
import { useDemoDocStore } from "@/lib/demo/store";
import { createId } from "@paralleldrive/cuid2";
import {
  ChatPanel,
  type ChatRow,
} from "@uxie/shared/components/chat/chat-panel";
import { EmptyStatePrompt } from "@uxie/shared/components/other/empty-state-prompt";
import { useChatStore } from "@uxie/shared/lib/store";
import { SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const renderMarkdown = (text: string) => <ReactMarkdown>{text}</ReactMarkdown>;

interface DemoMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

/**
 * A fully local, canned chat. It never calls an API — every "assistant" reply
 * is drawn from a fixed pool that openly says so. The streaming effect is
 * driven by local timers we control, so the indicators reflect real local
 * state (nothing is faked about an external system). Renders the shared
 * ChatPanel so it looks identical to the real chat.
 */
export default function DemoChat() {
  const isVectorised = useDemoDocStore((s) => s.isVectorised);
  const setIsVectorised = useDemoDocStore((s) => s.setIsVectorised);

  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const replyIndexRef = useRef(0);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const setSendMessage = useChatStore((s) => s.setSendMessage);

  const clearStreamTimer = () => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  };

  const streamCannedReply = useCallback(() => {
    const reply =
      DEMO_CHAT_REPLIES[replyIndexRef.current % DEMO_CHAT_REPLIES.length] ?? "";
    replyIndexRef.current += 1;

    const id = createId();
    setMessages((prev) => [...prev, { id, role: "assistant", text: "" }]);
    setIsStreaming(true);

    const words = reply.split(" ");
    let wordCount = 0;
    const tick = () => {
      wordCount += 1;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, text: words.slice(0, wordCount).join(" ") } : m,
        ),
      );
      if (wordCount < words.length) {
        streamTimerRef.current = setTimeout(tick, 30);
      } else {
        setIsStreaming(false);
        streamTimerRef.current = null;
      }
    };
    // brief pause so the typing indicator is visible before text appears
    streamTimerRef.current = setTimeout(tick, 420);
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      setMessages((prev) => [
        ...prev,
        { id: createId(), role: "user", text: trimmed },
      ]);
      streamCannedReply();
    },
    [isStreaming, streamCannedReply],
  );

  // Expose sending to the PDF text-selection popover ("explain"/"summarise").
  useEffect(() => {
    setSendMessage((message: string) => send(message));
  }, [send, setSendMessage]);

  useEffect(() => clearStreamTimer, []);

  // Focus the input once the chat becomes interactive.
  useEffect(() => {
    if (isVectorised) inputRef.current?.focus();
  }, [isVectorised]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    send(text);
    setInput("");
  };

  const handleStop = () => {
    clearStreamTimer();
    setIsStreaming(false);
  };

  if (!isVectorised) {
    return (
      <EmptyStatePrompt
        icon={<SparklesIcon className="h-6 w-6" />}
        title="Chat with this document"
        subtext="Ask anything and get instant answers straight from your PDF."
        buttonText="Start chatting"
        onClick={() => setIsVectorised(true)}
      />
    );
  }

  const rows: ChatRow[] = [
    { kind: "message", role: "assistant", content: DEMO_CHAT_WELCOME },
  ];
  for (const m of messages) {
    if (m.text) rows.push({ kind: "message", role: m.role, content: m.text });
  }
  const lastMessage = messages[messages.length - 1];
  if (isStreaming && lastMessage?.role === "assistant" && !lastMessage.text) {
    rows.push({ kind: "thinking", label: "Thinking…" });
  }

  return (
    <ChatPanel
      rows={rows}
      loaded
      input={input}
      onInputChange={setInput}
      onSubmit={handleSubmit}
      onStop={handleStop}
      streaming={isStreaming}
      renderMarkdown={renderMarkdown}
      inputRef={inputRef}
    />
  );
}

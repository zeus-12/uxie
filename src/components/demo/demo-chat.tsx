import FeatureCard from "@/components/other/feature-card";
import BouncingLoader from "@/components/ui/bouncing-loader";
import { Button } from "@/components/ui/button";
import { INITIAL_MESSAGE } from "@/components/chat";
import { DEMO_CHAT_REPLIES } from "@/lib/demo/seed";
import { useDemoDocStore } from "@/lib/demo/store";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import { ArrowUp, BanIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";

interface DemoMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

/**
 * A fully local, canned chat. It never calls an API — every "assistant" reply
 * is drawn from a fixed pool that openly says so. The streaming effect is
 * driven by local timers we control, so the indicators reflect real local
 * state (nothing is faked about an external system).
 */
export default function DemoChat() {
  const isVectorised = useDemoDocStore((s) => s.isVectorised);
  const setIsVectorised = useDemoDocStore((s) => s.setIsVectorised);

  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [localInput, setLocalInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const replyIndexRef = useRef(0);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageWindowRef = useRef<HTMLDivElement>(null);
  const { setSendMessage } = useChatStore();

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

  useEffect(() => {
    messageWindowRef.current?.scrollTo(
      0,
      messageWindowRef.current.scrollHeight,
    );
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (localInput.trim()) {
      send(localInput.trim());
      setLocalInput("");
    }
  };

  const handleStop = () => {
    clearStreamTimer();
    setIsStreaming(false);
  };

  if (!isVectorised) {
    return (
      <FeatureCard
        isLoading={false}
        bulletPoints={[
          "🔍 Ask questions about any part of your PDF.",
          "📝 Summarize content with ease.",
          "📊 Analyze and extract data effortlessly.",
        ]}
        onClick={() => setIsVectorised(true)}
        buttonText="Turn PDF Interactive"
        subtext="Try the chat experience (demo responses only):"
        title="Chat with your PDF — right here in the demo!"
      />
    );
  }

  const lastMessage = messages[messages.length - 1];
  const showLoader =
    isStreaming && lastMessage?.role === "assistant" && !lastMessage.text;

  return (
    <div className="flex h-full w-full flex-col gap-1 overflow-hidden md:gap-2">
      <div
        className="hideScrollbar flex flex-1 flex-col gap-3 overflow-auto"
        ref={messageWindowRef}
      >
        <MessageBubble role="assistant">
          <ReactMarkdown>{INITIAL_MESSAGE}</ReactMarkdown>
        </MessageBubble>

        {messages.map((m) =>
          m.text ? (
            <MessageBubble key={m.id} role={m.role}>
              <ReactMarkdown>{m.text}</ReactMarkdown>
            </MessageBubble>
          ) : null,
        )}

        {showLoader && (
          <MessageBubble role="assistant">
            <BouncingLoader />
          </MessageBubble>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mx-[2px] mb-1">
        <div className="flex w-full border border-gray-300 rounded-md focus-within:ring-blue-500 focus-within:ring-2">
          <TextareaAutosize
            maxLength={1000}
            placeholder="Type your question here..."
            className="resize-none rounded-lg px-3 py-2 font-normal active:ring-0 focus-visible:ring-0 focus:ring-0 focus:outline-none w-full"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isStreaming) handleSubmit();
              }
            }}
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            autoFocus
            maxRows={4}
          />
          <Button
            variant="ghost"
            size="icon"
            className="group w-fit px-2 bg-gray-100 rounded-md m-[2px] mt-auto"
            type={isStreaming ? "button" : "submit"}
            onClick={isStreaming ? handleStop : undefined}
          >
            {isStreaming ? (
              <BanIcon
                size={24}
                className="text-gray-500 group-hover:text-gray-700"
              />
            ) : (
              <ArrowUp
                size={24}
                className="text-gray-500 group-hover:text-gray-700"
              />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        role === "user" && "ml-auto",
        role === "assistant" && "mr-auto",
        "max-w-[80%] text-left",
      )}
    >
      <div
        className={cn(
          role === "user" &&
            "prose-invert bg-blue-500 text-gray-50 prose-code:text-gray-100",
          role === "assistant" && "bg-gray-100",
          "prose rounded-xl px-3 py-1 prose-ul:pl-2 prose-li:px-2",
        )}
      >
        {children}
      </div>
    </div>
  );
}

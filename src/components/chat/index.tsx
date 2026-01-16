import FeatureCard from "@/components/other/feature-card";
import BouncingLoader from "@/components/ui/bouncing-loader";
import { Button } from "@/components/ui/button";
import { SpinnerCentered } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, BanIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";

const INITIAL_MESSAGE = `Welcome to **Uxie**! I'm here to assist you. Feel free to ask questions or discuss topics based on the data provided.`;

export default function Chat({ isVectorised }: { isVectorised: boolean }) {
  const { query } = useRouter();
  const docId = typeof query?.docId === "string" ? query.docId : "";

  const { messages, status, stop, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { docId },
    }),
    onError: (err) => {
      toast.error("Something went wrong. Please try again.", {
        duration: 3000,
      });
    },
  });

  const isLoading = status === "streaming";

  const [localInput, setLocalInput] = useState("");
  const { setSendMessage } = useChatStore();

  useEffect(() => {
    setSendMessage((message: string) => sendMessage({ text: message }));
  }, [sendMessage, setSendMessage]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (localInput.trim()) {
      sendMessage({ text: localInput.trim() });
      setLocalInput("");
    }
  };

  const { data: prevChatMessages, isLoading: isChatsLoading } =
    api.message.getAllByDocId.useQuery(
      { docId },
      { refetchOnWindowFocus: false },
    );

  const messageWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageWindowRef.current?.scrollTo(
      0,
      messageWindowRef.current.scrollHeight,
    );
  }, [messages, prevChatMessages]);

  const { mutate: vectoriseDocMutation, isLoading: isVectorising } =
    api.document.vectorise.useMutation({
      onSuccess: () => {
        utils.document.getDocData.setData({ docId }, (prev) => {
          if (!prev) return undefined;
          return { ...prev, isVectorised: true };
        });
      },
    });

  const utils = api.useContext();

  if (!isVectorised) {
    return (
      <FeatureCard
        isLoading={isVectorising}
        bulletPoints={[
          "🔍 Search and ask questions about any part of your PDF.",
          "📝 Summarize content with ease.",
          "📊 Analyze and extract data effortlessly.",
        ]}
        onClick={() => {
          vectoriseDocMutation(
            { documentId: docId },
            {
              onError: (err) => {
                toast.error(err.message, { duration: 3000 });
              },
            },
          );
        }}
        buttonText="Turn PDF Interactive"
        subtext="Easily extract key information and ask questions on the fly:"
        title="Unleash the power of your PDF documents through interactive chat!"
      />
    );
  }

  if (isChatsLoading) {
    return <SpinnerCentered />;
  }

  const lastStreamingMsg = messages[messages.length - 1];
  const streamingHasContent =
    lastStreamingMsg?.parts.some(
      (p) => (p.type === "text" && p.text.trim()) || p.type.startsWith("tool-"),
    ) ?? false;

  return (
    <div className="flex h-full w-full flex-col gap-1 overflow-hidden md:gap-2">
      <div
        className="hideScrollbar flex flex-1 flex-col gap-3 overflow-auto"
        ref={messageWindowRef}
      >
        <MessageBubble role="assistant">
          <ReactMarkdown>{INITIAL_MESSAGE}</ReactMarkdown>
        </MessageBubble>

        {[...(prevChatMessages ?? []), ...(messages ?? [])]?.map((m) => (
          <MessageView key={m.id} role={m.role} parts={m.parts} />
        ))}

        {isLoading && !streamingHasContent && (
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
              if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                e.preventDefault();
                handleSubmit();
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
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
            className="group w-fit px-2 bg-gray-100 rounded-md m-[2px]"
            type={isLoading ? "button" : "submit"}
            onClick={isLoading ? stop : undefined}
          >
            {isLoading ? (
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

const TOOL_NAME_TO_MESSAGE: Record<string, string> = {
  getInformation: "Reading the document...",
};

interface MessagePart {
  type: string;
  text?: string;
  toolName?: string;
}

function MessageView({ role, parts }: { role: string; parts: unknown }) {
  if (!Array.isArray(parts)) return null;

  const hasContent = parts.some((p: MessagePart) => {
    if (p.type === "text" && p.text?.trim()) return true;
    if (p.type.startsWith("tool-") && p.type !== "tool-result") return true;
    return false;
  });
  if (!hasContent) return null;

  const displayRole = role === "user" ? "user" : "assistant";

  return (
    <MessageBubble role={displayRole}>
      {parts.map((part, i) => {
        if (part.type === "text" && part.text?.trim()) {
          return <ReactMarkdown key={i}>{part.text}</ReactMarkdown>;
        }

        if (part.type.startsWith("tool-") && part.type !== "tool-result") {
          const toolName = part.type.replace("tool-", "");
          const msg = TOOL_NAME_TO_MESSAGE[toolName] || `${toolName} called`;
          return (
            <div key={i} className="mb-1 text-xs text-gray-500 italic">
              {msg}
            </div>
          );
        }

        return null;
      })}
    </MessageBubble>
  );
}

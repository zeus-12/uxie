import { api } from "@/lib/api";
import { useChat } from "@ai-sdk/react";
import {
  ChatPanel,
  type ChatRow,
} from "@uxie/shared/components/chat/chat-panel";
import { EmptyStatePrompt } from "@uxie/shared/components/other/empty-state-prompt";
import {
  IndexingFailed,
  IndexingState,
} from "@uxie/shared/components/other/indexing-state";
import { SpinnerCentered } from "@uxie/shared/components/ui/spinner";
import { useChatImageAttachments } from "@uxie/shared/hooks/use-chat-image-attachments";
import {
  attachmentFromDataUrl,
  type ChatImageAttachment,
} from "@uxie/shared/lib/chat-attachments";
import { useChatStore, useSidebarTabStore } from "@uxie/shared/lib/store";
import { DefaultChatTransport, type FileUIPart } from "ai";
import { SparklesIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const renderMarkdown = (text: string) => <ReactMarkdown>{text}</ReactMarkdown>;

export default function Chat({ isVectorised }: { isVectorised: boolean }) {
  const { query } = useRouter();
  const docId = typeof query?.docId === "string" ? query.docId : "";

  if (!isVectorised) {
    return <VectoriseGate docId={docId} />;
  }
  return <ChatView docId={docId} />;
}

function VectoriseGate({ docId }: { docId: string }) {
  const utils = api.useContext();
  const {
    mutate: vectorise,
    isLoading: isVectorising,
    error,
  } = api.document.vectorise.useMutation({
    onSuccess: () => {
      utils.document.getDocData.setData({ docId }, (prev) =>
        prev ? { ...prev, isVectorised: true } : undefined,
      );
    },
  });

  const start = () => vectorise({ documentId: docId });

  if (error) return <IndexingFailed message={error.message} onRetry={start} />;
  // The mutation reports "in flight" and nothing else, so there is no fraction
  // to show here — only motion.
  if (isVectorising) return <IndexingState value={null} />;

  return (
    <EmptyStatePrompt
      icon={<SparklesIcon className="h-6 w-6" />}
      title="Chat with this document"
      subtext="Ask anything and get answers grounded in this document."
      buttonText="Start chatting"
      onClick={start}
    />
  );
}

// A stored/streamed message part, loosely typed — the same shape flows from the
// live `useChat` stream and from persisted DB messages (trpc JSON).
type LoosePart = {
  type: string;
  text?: string;
  state?: string;
  filename?: string;
  mediaType?: string;
  url?: string;
};
const partsOf = (m: { parts?: unknown }): LoosePart[] =>
  Array.isArray(m.parts) ? (m.parts as LoosePart[]) : [];

// Fan a message's parts into flat rows: text → a bubble, a tool call → a chip
// that sits OUTSIDE the bubble (ChatGPT-style). tool-result parts are internal.
function messageToRows(role: string, parts: LoosePart[]): ChatRow[] {
  const displayRole = role === "user" ? "user" : "assistant";
  if (displayRole === "user") {
    const content = parts
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("");
    const attachments = parts.flatMap((part, index): ChatImageAttachment[] => {
      if (part.type !== "file" || !part.url) return [];
      const result = attachmentFromDataUrl({
        url: part.url,
        filename: part.filename ?? "Attached image",
        id: `attachment-${index}`,
      });
      return result.kind === "attachment" ? [result.attachment] : [];
    });
    return content.trim() || attachments.length
      ? [
          {
            kind: "message",
            role: "user",
            content,
            attachments,
          },
        ]
      : [];
  }

  const rows: ChatRow[] = [];
  for (const p of parts) {
    if (p.type === "text") {
      if (p.text?.trim()) {
        rows.push({ kind: "message", role: displayRole, content: p.text });
      }
    } else if (p.type.startsWith("tool-") && p.type !== "tool-result") {
      const active =
        p.state !== undefined &&
        p.state !== "output-available" &&
        p.state !== "output-error";
      rows.push({
        kind: "tool",
        label: active ? "Searching the document…" : "Searched the document",
        active,
      });
    }
  }
  return rows;
}

function ChatView({ docId }: { docId: string }) {
  const { messages, status, stop, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", body: { docId } }),
  });

  const { data: prevChatMessages, isLoading: isChatsLoading } =
    api.message.getAllByDocId.useQuery(
      { docId },
      { refetchOnWindowFocus: false },
    );

  const [input, setInput] = useState("");
  const {
    attachments,
    attachmentError,
    addDataUrl,
    addFiles,
    removeAttachment,
    clearAttachments,
  } = useChatImageAttachments();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streaming = status === "streaming" || status === "submitted";

  const submit = () => {
    const text = input.trim();
    if ((!text && !attachments.length) || streaming) return;
    const files: FileUIPart[] = attachments.map((attachment) => ({
      type: "file",
      filename: attachment.filename,
      mediaType: attachment.mediaType,
      url: attachment.url,
    }));
    if (text) void sendMessage({ text, files });
    else void sendMessage({ files });
    setInput("");
    clearAttachments();
  };

  // Register a sender (highlight popover → chat) + a focuser (⌘L) on the shared
  // store, and focus the input whenever the chat tab becomes active.
  const setSendMessage = useChatStore((s) => s.setSendMessage);
  const setStageImageAttachment = useChatStore(
    (s) => s.setStageImageAttachment,
  );
  const setFocusInput = useChatStore((s) => s.setFocusInput);
  const tab = useSidebarTabStore((s) => s.tab);
  useEffect(() => {
    setSendMessage((text: string) => sendMessage({ text }));
    return () => setSendMessage(null);
  }, [sendMessage, setSendMessage]);
  useEffect(() => {
    setStageImageAttachment((dataUrl: string) => {
      addDataUrl(dataUrl, "PDF selection.png");
    });
    return () => setStageImageAttachment(null);
  }, [addDataUrl, setStageImageAttachment]);
  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    setFocusInput(focus);
    return () => setFocusInput(null);
  }, [setFocusInput]);
  useEffect(() => {
    if (tab === "chat") inputRef.current?.focus();
  }, [tab]);

  // ⌘1/2/3 switch tabs; ⌘L jumps to chat and focuses its input.
  const setTab = useSidebarTabStore((s) => s.setTab);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key === "1") {
        e.preventDefault();
        setTab("notes");
      } else if (e.key === "2") {
        e.preventDefault();
        setTab("chat");
      } else if (e.key === "3") {
        e.preventDefault();
        setTab("flashcards");
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        setTab("chat");
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTab]);

  if (isChatsLoading) return <SpinnerCentered />;

  const history = [...(prevChatMessages ?? []), ...messages];
  const rows: ChatRow[] = [];
  for (const m of history) rows.push(...messageToRows(m.role, partsOf(m)));

  // Current turn hasn't produced a tool chip or any text yet → a Thinking
  // shimmer, driven by the real in-flight request status.
  if (streaming) {
    const last = messages[messages.length - 1];
    const lastHasAssistantContent =
      !!last &&
      last.role !== "user" &&
      messageToRows(last.role, partsOf(last)).length > 0;
    if (!lastHasAssistantContent)
      rows.push({ kind: "thinking", label: "Thinking…" });
  }

  if (status === "error") {
    rows.push({
      kind: "error",
      content: "Something went wrong. Please try again.",
    });
  }

  return (
    <ChatPanel
      rows={rows}
      loaded={!isChatsLoading}
      input={input}
      attachments={attachments}
      attachmentError={attachmentError}
      onInputChange={setInput}
      onFilesSelected={(files) => void addFiles(files)}
      onRemoveAttachment={removeAttachment}
      onSubmit={submit}
      onStop={stop}
      streaming={streaming}
      renderMarkdown={renderMarkdown}
      inputRef={inputRef}
    />
  );
}

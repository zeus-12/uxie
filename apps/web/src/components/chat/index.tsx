import { api } from "@/lib/api";
import {
  chatErrorMessage,
  chatRequestBody,
  MAX_WEB_CHAT_IMAGE_TOTAL_BYTES,
  withoutEarlierImageData,
} from "@/lib/chat-images";
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
import {
  useChatImageAttachments,
  type StagedChatImage,
} from "@uxie/shared/hooks/use-chat-image-attachments";
import {
  userMessageRows,
  type ChatImage,
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

function messageToRows(role: string, parts: LoosePart[]): ChatRow[] {
  const displayRole = role === "user" ? "user" : "assistant";
  if (displayRole === "user") {
    const content = parts
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("");
    const attachments = parts.flatMap((part, index): ChatImage[] =>
      part.type === "file"
        ? [
            {
              id: String(index),
              filename: part.filename ?? "image",
              url: part.url?.startsWith("data:image/") ? part.url : null,
            },
          ]
        : [],
    );
    return userMessageRows(content, attachments);
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

type Turn = { text: string; images: StagedChatImage[] };

function withoutLastUserMessage<M extends { role: string }>(messages: M[]) {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === "user") return messages.slice(0, index);
  }
  return messages;
}

function ChatView({ docId }: { docId: string }) {
  const turnRef = useRef<Turn | null>(null);
  const undoTurnRef = useRef<(turn: Turn) => void>(() => undefined);
  const { messages, status, error, stop, sendMessage, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, body }) => ({
        body: chatRequestBody({
          ...body,
          docId,
          messages: withoutEarlierImageData(messages),
        }),
      }),
    }),
    onFinish: ({ isError, isAbort }) => {
      const turn = turnRef.current;
      turnRef.current = null;
      if ((isError || isAbort) && turn) undoTurnRef.current(turn);
    },
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
    attachmentsPending,
    addDataUrl,
    addFiles,
    removeAttachments,
    clearAttachments,
    restoreAttachments,
  } = useChatImageAttachments({
    maxTotalBytes: MAX_WEB_CHAT_IMAGE_TOTAL_BYTES,
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streaming = status === "streaming" || status === "submitted";

  const submit = () => {
    const text = input.trim();
    if ((!text && !attachments.length) || streaming) return;
    if (attachmentsPending > 0) return;
    const files: FileUIPart[] = attachments.map((attachment) => ({
      type: "file",
      filename: attachment.filename,
      mediaType: attachment.mediaType,
      url: attachment.url,
    }));
    turnRef.current = { text, images: attachments };
    if (text) void sendMessage({ text, files });
    else void sendMessage({ files });
    setInput("");
    clearAttachments();
  };

  undoTurnRef.current = (turn) => {
    setMessages(withoutLastUserMessage);
    if (turn.text) {
      setInput((current) => (current ? `${turn.text}\n${current}` : turn.text));
    }
    restoreAttachments(turn.images);
  };

  const setSendMessage = useChatStore((s) => s.setSendMessage);
  const setStageImageAttachment = useChatStore(
    (s) => s.setStageImageAttachment,
  );
  const setFocusInput = useChatStore((s) => s.setFocusInput);
  const tab = useSidebarTabStore((s) => s.tab);
  useEffect(() => {
    setSendMessage((text: string) => {
      turnRef.current = { text: "", images: [] };
      void sendMessage({ text });
    });
    return () => setSendMessage(null);
  }, [sendMessage, setSendMessage]);
  useEffect(() => {
    setStageImageAttachment((dataUrl: string) => {
      void addDataUrl(dataUrl, "PDF selection.png");
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
      content: chatErrorMessage(error),
    });
  }

  return (
    <ChatPanel
      rows={rows}
      loaded={!isChatsLoading}
      input={input}
      attachments={attachments}
      attachmentError={attachmentError}
      attachmentsPending={attachmentsPending}
      onInputChange={setInput}
      onFilesSelected={(files) => void addFiles(files)}
      onRemoveAttachment={(id) => removeAttachments([id])}
      onSubmit={submit}
      onStop={stop}
      streaming={streaming}
      renderMarkdown={renderMarkdown}
      inputRef={inputRef}
    />
  );
}

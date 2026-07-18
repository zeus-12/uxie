import { useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { EmptyStatePrompt } from "@uxie/shared/components/other/empty-state-prompt";
import {
  ChatPanel,
  type ChatRow,
} from "@uxie/shared/components/chat/chat-panel";
import { useChatStore, useSidebarTabStore } from "@uxie/shared/lib/store";
import type { ChatMessage } from "../ipc-contract";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const renderMarkdown = (text: string) => <ReactMarkdown>{text}</ReactMarkdown>;

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

  if (progress) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
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
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EmptyStatePrompt
        icon={<SparklesIcon className="h-6 w-6" />}
        title="Chat with this document"
        subtext="Ask anything and get instant answers straight from your PDF — perfect for summarizing, studying, and turning it into flashcards."
        buttonText="Start chatting"
        loadingText="Getting ready…"
        onClick={index}
      />
      {error && (
        <p className="pb-3 text-center text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

function ChatView({ docId }: { docId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [retrieving, setRetrieving] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamIdRef = useRef<string | null>(null);
  const accRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    window.uxieAPI
      .getMessages(docId)
      .then((m) => {
        if (cancelled) return;
        setMessages(m);
        setLoaded(true);
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // The chat itself streams from main over IPC. We only keep the retrieval here
  // because the embedding model lives in the renderer's Web Worker.
  useEffect(() => {
    function finalize() {
      streamIdRef.current = null;
      accRef.current = "";
      setStreaming(false);
      setRetrieving(false);
      setStreamingText("");
    }

    const offDelta = window.uxieAPI.onChatDelta((sid, delta) => {
      if (sid !== streamIdRef.current) return;
      setRetrieving(false);
      accRef.current += delta;
      setStreamingText(accRef.current);
    });
    const offRetrieving = window.uxieAPI.onChatRetrieving((sid) => {
      if (sid !== streamIdRef.current) return;
      setRetrieving(true);
      setSearchedOnce(true);
    });
    const offDone = window.uxieAPI.onChatDone((sid, full) => {
      if (sid !== streamIdRef.current) return;
      if (full) {
        setMessages((m) => [...m, { role: "assistant", content: full }]);
        void window.uxieAPI.createMessage(docId, "assistant", full).catch(() => {});
      }
      finalize();
    });
    const offError = window.uxieAPI.onChatError((sid, msg) => {
      if (sid !== streamIdRef.current) return;
      setError(msg);
      finalize();
    });
    // Main asks us to retrieve (embed in the worker + query the vector store).
    const offRetrieve = window.uxieAPI.onChatRetrieve((reqId, dId, question) => {
      import("./rag")
        .then(({ retrieve }) => retrieve(dId, question))
        .then((chunks) => window.uxieAPI.chatRetrieveReply(reqId, chunks))
        .catch(() => window.uxieAPI.chatRetrieveReply(reqId, null));
    });

    return () => {
      offDelta();
      offRetrieving();
      offDone();
      offError();
      offRetrieve();
    };
  }, [docId]);

  // Register a focuser + auto-focus when the chat tab becomes active.
  const setFocusInput = useChatStore((s) => s.setFocusInput);
  const tab = useSidebarTabStore((s) => s.tab);
  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    setFocusInput(focus);
    return () => setFocusInput(null);
  }, [setFocusInput]);
  useEffect(() => {
    if (tab === "chat") inputRef.current?.focus();
  }, [tab]);

  const rows: ChatRow[] = messages.map((m) => ({
    kind: "message",
    role: m.role,
    content: m.content,
  }));
  // The current assistant turn: an optional tool chip (outside the bubble, like
  // ChatGPT), then either the streaming answer or a "thinking" shimmer.
  if (streaming) {
    if (searchedOnce) {
      rows.push({
        kind: "tool",
        label: retrieving ? "Searching the document…" : "Searched the document",
        active: retrieving,
      });
    }
    if (streamingText) rows.push({ kind: "streaming", content: streamingText });
    else if (!retrieving) rows.push({ kind: "thinking", label: "Thinking…" });
  }
  if (error) rows.push({ kind: "error", content: error });

  function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || streaming) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setError(null);
    setStreaming(true);
    setRetrieving(false);
    setSearchedOnce(false);
    setStreamingText("");
    accRef.current = "";

    const streamId = createId();
    streamIdRef.current = streamId;
    void window.uxieAPI.createMessage(docId, "user", text).catch(() => {});
    window.uxieAPI.startChat(streamId, docId, history);
  }

  function stop() {
    if (streamIdRef.current) window.uxieAPI.cancelChat(streamIdRef.current);
  }

  // Let the highlight popover push a message into this chat. Route through a ref
  // so the registered handler always uses the latest state (messages/streaming).
  const sendRef = useRef(send);
  sendRef.current = send;
  const setSendMessage = useChatStore((s) => s.setSendMessage);
  useEffect(() => {
    setSendMessage((text: string) => sendRef.current(text));
  }, [setSendMessage]);

  return (
    <ChatPanel
      rows={rows}
      loaded={loaded}
      input={input}
      onInputChange={setInput}
      onSubmit={() => send()}
      onStop={stop}
      streaming={streaming}
      renderMarkdown={renderMarkdown}
      inputRef={inputRef}
    />
  );
}

import { useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { SparklesIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { EmptyStatePrompt } from "@uxie/shared/components/other/empty-state-prompt";
import {
  IndexingFailed,
  IndexingState,
} from "@uxie/shared/components/other/indexing-state";
import {
  ChatPanel,
  type ChatRow,
} from "@uxie/shared/components/chat/chat-panel";
import { useChatImageAttachments } from "@uxie/shared/hooks/use-chat-image-attachments";
import { useChatStore, useSidebarTabStore } from "@uxie/shared/lib/store";
import {
  chatMessageToRows,
  type ChatMessage,
  type CreateUserMessageResult,
} from "../chat-messages";

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
  const [indexing, setIndexing] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function index() {
    const { vectorise } = await import("./rag");
    setError(null);
    setProgress(null);
    setIndexing(true);
    try {
      await vectorise(docId, (done, total) => setProgress({ done, total }));
      onIndexed();
    } catch (e) {
      setError(message(e));
      setIndexing(false);
      setProgress(null);
    }
  }

  if (error) return <IndexingFailed message={error} onRetry={index} />;

  // No fraction until the text has been chunked — fetching and chunking report
  // nothing, so those seconds run without a percentage.
  if (indexing) {
    return (
      <IndexingState
        value={progress?.total ? progress.done / progress.total : null}
      />
    );
  }

  return (
    <EmptyStatePrompt
      icon={<SparklesIcon className="h-6 w-6" />}
      title="Chat with this document"
      subtext="Ask anything and get instant answers straight from your PDF."
      buttonText="Start chatting"
      onClick={index}
    />
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
  const [sending, setSending] = useState(false);
  const {
    attachments,
    attachmentError,
    attachmentsPending,
    addDataUrl,
    addFiles,
    removeAttachments,
  } = useChatImageAttachments();

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
    const offDone = window.uxieAPI.onChatDone((sid, parts) => {
      if (sid !== streamIdRef.current) return;
      if (parts.length) {
        setMessages((m) => [...m, { role: "assistant", parts }]);
        void window.uxieAPI
          .createMessage(docId, "assistant", parts)
          .catch(() => {});
      }
      finalize();
    });
    const offError = window.uxieAPI.onChatError((sid, msg) => {
      if (sid !== streamIdRef.current) return;
      setError(msg);
      finalize();
    });
    const offRetrieve = window.uxieAPI.onChatRetrieve(
      (reqId, dId, question) => {
        import("./rag")
          .then(({ retrieve }) => retrieve(dId, question))
          .then((chunks) => window.uxieAPI.chatRetrieveReply(reqId, chunks))
          .catch(() => window.uxieAPI.chatRetrieveReply(reqId, null));
      },
    );

    return () => {
      offDelta();
      offRetrieving();
      offDone();
      offError();
      offRetrieve();
    };
  }, [docId]);

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

  const rows: ChatRow[] = messages.flatMap(chatMessageToRows);
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

  async function send(override?: string) {
    const submittedInput = input;
    const text = (override ?? submittedInput).trim();
    const images = override === undefined ? attachments : [];
    if ((!text && !images.length) || streaming || sending) return;

    setSending(true);
    let created: CreateUserMessageResult;
    try {
      created = await window.uxieAPI.createUserMessage(
        docId,
        text,
        await Promise.all(
          images.map(async (image) => ({
            filename: image.filename,
            bytes: new Uint8Array(await image.blob.arrayBuffer()),
          })),
        ),
      );
    } catch (e) {
      setError(`Couldn't send the message: ${message(e)}`);
      return;
    } finally {
      setSending(false);
    }
    if (!created.ok) {
      setError(`Couldn't send the message: ${created.error}`);
      return;
    }

    const history: ChatMessage[] = [...messages, created.message];
    setMessages(history);
    if (override === undefined) {
      setInput((current) => (current === submittedInput ? "" : current));
      removeAttachments(images.map((image) => image.id));
    }
    setError(null);
    setStreaming(true);
    setRetrieving(false);
    setSearchedOnce(false);
    setStreamingText("");
    accRef.current = "";

    const streamId = createId();
    streamIdRef.current = streamId;
    window.uxieAPI.startChat(streamId, docId, history);
  }

  function stop() {
    if (streamIdRef.current) window.uxieAPI.cancelChat(streamIdRef.current);
  }

  const sendRef = useRef(send);
  sendRef.current = send;
  const setSendMessage = useChatStore((s) => s.setSendMessage);
  const setStageImageAttachment = useChatStore(
    (s) => s.setStageImageAttachment,
  );
  useEffect(() => {
    setSendMessage((text: string) => void sendRef.current(text));
    return () => setSendMessage(null);
  }, [setSendMessage]);
  useEffect(() => {
    setStageImageAttachment((dataUrl: string) => {
      void addDataUrl(dataUrl, "PDF selection.png");
    });
    return () => setStageImageAttachment(null);
  }, [addDataUrl, setStageImageAttachment]);

  return (
    <ChatPanel
      rows={rows}
      loaded={loaded}
      input={input}
      attachments={attachments}
      attachmentError={attachmentError}
      attachmentsPending={attachmentsPending}
      sending={sending}
      onInputChange={setInput}
      onFilesSelected={(files) => void addFiles(files)}
      onRemoveAttachment={(id) => removeAttachments([id])}
      onSubmit={() => void send()}
      onStop={stop}
      streaming={streaming}
      renderMarkdown={renderMarkdown}
      inputRef={inputRef}
    />
  );
}

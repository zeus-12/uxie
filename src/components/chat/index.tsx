import FeatureCard from "@/components/other/feature-card";
import BouncingLoader from "@/components/ui/bouncing-loader";
import { SpinnerCentered } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useChat } from "ai/react";
import { ArrowUp, BanIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";

export default function Chat({ isVectorised }: { isVectorised: boolean }) {
  const { query } = useRouter();

  const docId = query?.docId as string;

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    error,
    append,
  } = useChat({
    body: {
      docId,
    },
    maxSteps: 2,
    onError: (err: any) => {
      toast.error(err?.message, {
        duration: 3000,
      });
    },
  });

  const { setSendMessage } = useChatStore();

  useEffect(() => {
    const sendMessage = (message: string) => {
      append({
        id: crypto.randomUUID(),
        content: message,
        role: "user",
      });
    };

    setSendMessage(sendMessage);
  }, []);

  //implement autoscrolling, and infinite loading => also fetch the messages from prev session and display
  const { data: prevChatMessages, isLoading: isChatsLoading } =
    api.message.getAllByDocId.useQuery(
      {
        docId: docId,
      },
      {
        refetchOnWindowFocus: false,
      },
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
          return {
            ...prev,
            isVectorised: true,
          };
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
              onError: (err: any) => {
                toast.error(err?.message, {
                  duration: 3000,
                });
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

  return (
    <div className="flex h-full w-full flex-col gap-1 overflow-hidden md:gap-2">
      <div
        className="hideScrollbar flex flex-1 flex-col gap-3 overflow-auto"
        ref={messageWindowRef}
      >
        {[
          {
            id: "id",
            content:
              "Welcome to **Uxie**! I'm here to assist you. Feel free to ask questions or discuss topics based on the data provided. Whether it's clarifying information, diving deeper into a subject, or exploring related topics, I'm ready to help. Let's make the most out of your learning!",

            role: "assistant",
          },
          ...(prevChatMessages ?? []),
          ...messages,
        ].map((m) => (
          <div
            key={m.id}
            className={cn(
              m.role === "user" && "ml-auto",
              m.role === "assistant" && "mr-auto",
              "max-w-[80%] text-left ",
            )}
          >
            {m.content.length > 0 ? (
              <ReactMarkdown
                className={cn(
                  m.role === "user" &&
                    "prose-invert bg-blue-500 text-gray-50 prose-code:text-gray-100",
                  m.role === "assistant" && "bg-gray-100 ",
                  "prose rounded-xl px-3 py-1 prose-ul:pl-2 prose-li:px-2",
                )}
              >
                {m.content}
              </ReactMarkdown>
            ) : (
              <span className="text-gray-500 italic text-sm">
                Searching the PDF for relevant information
              </span>
            )}
          </div>
        ))}

        {isLoading && (
          <div
            className={cn(
              "mr-auto bg-gray-100 text-black",
              "max-w-[80%] rounded-xl px-3 py-2 text-left ",
            )}
          >
            <BouncingLoader />
          </div>
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
                handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
              }
            }}
            value={input}
            onChange={handleInputChange}
            autoFocus
            maxRows={4}
          />
          <button
            className="group w-fit px-2 bg-gray-100 rounded-md m-[2px]"
            type={isLoading ? "button" : "submit"}
          >
            {isLoading ? (
              <BanIcon
                size={24}
                className="text-gray-500 group-hover:text-gray-700"
                onClick={stop}
              />
            ) : (
              <ArrowUp
                size={24}
                className="text-gray-500 group-hover:text-gray-700"
              />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

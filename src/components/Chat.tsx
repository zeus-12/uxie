import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useChat } from "ai/react";
import { Send } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";

export default function Chat() {
  const { query } = useRouter();

  const docId = query?.docId;

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      body: {
        docId: docId as string,
      },
    });

  //implement autoscrolling, and infinite loading => also fetch the messages from prev session and display
  // const { data: messages } = api.message.getAll.useQuery({
  //   docId: docId as string,
  //   userId: userId as string,
  // })

  const messageWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messageWindowRef.current) {
      messageWindowRef.current.scrollTop =
        messageWindowRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden">
      <div
        className="hideScrollbar flex flex-1 flex-col gap-2 overflow-auto"
        ref={messageWindowRef}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              m.role === "user" && "ml-auto bg-blue-500 text-white",
              m.role === "assistant" && "mr-auto bg-gray-200 text-black",
              "max-w-[90%] select-none rounded-xl px-3 py-1 text-left ",
            )}
          >
            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex w-full rounded-md border shadow-xl">
          <TextareaAutosize
            className="flex-1 resize-none rounded border-0 border-gray-300 p-2"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                e.preventDefault();
                // @ts-ignore
                handleSubmit(e);
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
            className="w-fit bg-gray-50 px-2"
            type="submit"
            disabled={isLoading}
          >
            <Send
              size={24}
              className={cn(isLoading && "text-gray-400 hover:cursor-none")}
            />
          </button>
        </div>
      </form>
    </div>
  );
}

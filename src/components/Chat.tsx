import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useChat } from "ai/react";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

export default function Chat() {
  const { query } = useRouter();

  const docId = query?.docId;

  const { messages, input, handleInputChange, handleSubmit } = useChat({
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
          <input
            className="flex-1 rounded border-0 border-gray-300 p-2 "
            value={input}
            onChange={handleInputChange}
          />
          <button className="w-fit bg-gray-50 px-2" type="submit">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

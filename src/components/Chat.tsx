import { cn } from "@/lib/utils";
import { useChat } from "ai/react";
import { useRouter } from "next/router";
import ReactMarkdown from "react-markdown";

export default function Chat() {
  const { query } = useRouter();

  const docId = query?.docId;

  const { messages, input, handleInputChange, handleSubmit } = useChat({
    body: {
      docId: docId as string,
    },
  });

  return (
    <div className="stretch mx-auto flex w-full flex-col gap-2 py-24">
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

      <div className="fixed bottom-4 ">
        <form onSubmit={handleSubmit}>
          <div className="border shadow-xl">
            <input
              className="w-[80%] rounded border-0 border-gray-300 p-2 "
              value={input}
              onChange={handleInputChange}
            />
            <button type="submit">Send</button>
          </div>
        </form>
      </div>
    </div>
  );
}

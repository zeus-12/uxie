import BouncingDotsLoader from "@/components/BouncingDotsLoader";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useChat } from "ai/react";
import { BanIcon, Send } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";

export default function Chat({ isVectorised }: { isVectorised: boolean }) {
  const { query } = useRouter();

  const docId = query?.docId;

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    error,
  } = useChat({
    body: {
      docId: docId as string,
    },

    onError: (err: any) => {
      toast({
        title: "Error",
        description: error?.message ?? "Something went wrong",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  //implement autoscrolling, and infinite loading => also fetch the messages from prev session and display
  const { data: prevChatMessages } = api.message.getAllByDocId.useQuery(
    {
      docId: docId as string,
    },
    {
      refetchOnWindowFocus: false,
    },
  );

  const messageWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // this is not the best way to do this, but it works for now
    if (messageWindowRef.current) {
      messageWindowRef.current.scrollTop =
        messageWindowRef.current.scrollHeight;
    }
  }, [messages]);

  const {
    mutate: reVectoriseDocMutation,
    isLoading: isRevectorisingDocMutationLoading,
  } = api.document.revectorise.useMutation();

  const utils = api.useContext();

  if (!isVectorised) {
    return (
      <div className="mx-auto flex h-full max-w-[70%] flex-col items-center justify-center">
        <p className="font-xl  text-center">
          This document couldn&apos;t be vectorised, and therefore cannot be
          used with the AI assistant.{" "}
        </p>

        <Button
          className="mt-2"
          disabled={isRevectorisingDocMutationLoading}
          onClick={() => {
            reVectoriseDocMutation(
              {
                documentId: docId as string,
              },
              {
                onSuccess: () => {
                  utils.document.getDocData.setData(
                    { docId: docId as string },
                    (old) => {
                      if (!old) return undefined;
                      return {
                        ...old,
                        isVectorised: true,
                      };
                    },
                  );
                  toast({
                    title: "Success",
                    description: "Document re-vectorised",
                    variant: "default",
                    duration: 3000,
                  });
                },
                onError: (err: any) => {
                  toast({
                    title: "Uh-oh",
                    description: err?.message ?? "Something went wrong",
                    variant: "destructive",
                    duration: 3000,
                  });
                },
              },
            );
          }}
        >
          {isRevectorisingDocMutationLoading && <Spinner />}
          Re-vectorise
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden">
      <div
        className="hideScrollbar flex flex-1 flex-col gap-2 overflow-auto"
        ref={messageWindowRef}
      >
        {[
          {
            id: "id",
            content: `Hello! I'm AI assistant, your friendly and knowledgeable AI friend. I'm here to help you with any questions or topics you'd like to discuss. I've been trained on a vast amount of information, including the context you provided, and I'm eager to share my knowledge with you.`,
            role: "assistant",
          },
          ...(prevChatMessages ?? []),

          ...messages,
        ].map((m) => (
          <div
            key={m.id}
            className={cn(
              m.role === "user" && "ml-auto bg-blue-500 text-white",
              m.role === "assistant" && "mr-auto bg-gray-100 text-black",
              "max-w-[80%] rounded-xl px-3 py-1 text-left ",
            )}
          >
            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        ))}

        {isLoading && messages.at(-1)?.role === "user" && (
          <div
            className={cn(
              "mr-auto bg-gray-100 text-black",
              "max-w-[80%] rounded-xl px-3 py-2 text-left ",
            )}
          >
            <BouncingDotsLoader />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex w-full rounded-md border shadow-xl">
          <TextareaAutosize
            placeholder="Ask any question..."
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
          {isLoading ? (
            <button className="w-fit bg-gray-50 px-2">
              <BanIcon size={24} className="text-gray-500" onClick={stop} />
            </button>
          ) : (
            <button
              className="group w-fit rounded-ee-md rounded-se-md bg-blue-500 px-2"
              type="submit"
            >
              <Send
                size={24}
                className="text-gray-100 group-hover:text-gray-200"
              />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

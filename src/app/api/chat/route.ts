import { env } from "@/env.mjs";
import fireworks from "@/lib/fireworks";
import { getPineconeClient } from "@/lib/pinecone";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { getServerSession } from "next-auth";

// export const runtime = "edge";
export async function POST(req: Request, res: Response) {
  const { messages, docId } = await req.json();
  // use zod validations here

  if (typeof docId !== "string")
    return new Response("Not found", { status: 404 });

  const session = await getServerSession(authOptions);
  if (!session) return new Response("Not found", { status: 404 });

  const doc = await prisma.document.findFirst({
    where: {
      id: docId,
      OR: [
        { ownerId: session?.user.id },

        {
          collaborators: {
            some: {
              userId: session?.user.id,
            },
          },
        },
      ],
    },
  });

  if (!doc?.isVectorised) {
    throw new Error("Document not vectorised.");
  }

  if (!doc) return new Response("Not found", { status: 404 });

  const embeddings = new HuggingFaceInferenceEmbeddings({
    apiKey: env.HUGGINGFACE_API_KEY,
  });

  const pinecone = getPineconeClient();
  const pineconeIndex = pinecone.Index("uxie");

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    filter: {
      fileId: docId as string,
    },
  });

  const lastMessage = messages.at(-1).content;

  const results = await vectorStore.similaritySearch(lastMessage, 4);

  // const prevMessages = await prisma.message.findMany({
  //   where: {
  //     documentId: docId as string,
  //   },
  //   orderBy: {
  //     createdAt: "asc",
  //   },
  //   take: 6,
  // });

  // const formattedPrevMessages = prevMessages.map((msg) => ({
  //   role: msg.isUserMessage ? ("user" as const) : ("assistant" as const),
  //   content: msg.text,
  // }));

  const response = await fireworks.chat.completions.create({
    model: "accounts/fireworks/models/mixtral-8x7b-instruct",
    temperature: 0,
    stream: true,
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: `AI assistant is a brand new, powerful, human-like artificial intelligence.
        The traits of AI include expert knowledge, helpfulness, cleverness, and articulateness.
        AI is a well-behaved and well-mannered individual.
        AI is always friendly, kind, and inspiring, and he is eager to provide vivid and thoughtful responses to the user.
        AI has the sum of all knowledge in their brain, and is able to accurately answer nearly any question about any topic in conversation.
        START CONTEXT BLOCK
        ${results.map((r) => r.pageContent).join("\n\n")}
        END OF CONTEXT BLOCK
        AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
        If the context does not provide the answer to question, the AI assistant will say, "I'm sorry, but I don't know the answer to that question".
        AI assistant will not apologize for previous responses, but instead will indicated new information was gained.
        AI assistant will not invent anything that is not drawn directly from the context.
        AI assistant will answer the questions in Markdown format with clear headings and lists.
        `,
      },
      ...messages,
    ],
    //   messages: [
    //     {
    //       role: "system",
    //       content:
    //         "Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format.",
    //     },
    //     {
    //       role: "user",
    //       content: `Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format. \nIf you don't know the answer, just say that you don't know, don't try to make up an answer.

    // \n----------------\n

    // PREVIOUS CONVERSATION:
    // ${formattedPrevMessages.map((message) => {
    //   if (message.role === "user") return `User: ${message.content}\n`;
    //   return `Assistant: ${message.content}\n`;
    // })}

    // \n----------------\n

    // CONTEXT:
    // ${results.map((r) => r.pageContent).join("\n\n")}

    // USER INPUT: ${lastMessage}`,
    //     },
    //   ],
  });

  const stream = OpenAIStream(response, {
    onStart: async () => {
      await prisma.message.create({
        data: {
          text: messages.at(-1).content,
          isUserMessage: true,
          documentId: docId,
          userId: session?.user.id,
        },
      });
    },
    onCompletion: async (completion: string) => {
      // add user message first then assistant message

      await prisma.message.create({
        data: {
          text: completion,
          isUserMessage: false,
          documentId: docId,
        },
      });
    },
  });
  return new StreamingTextResponse(stream);
}

import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse, Message } from "ai";
import { NextResponse } from "next/server";
import { getPineconeClient } from "@/lib/pinecone";
// import { getContext } from "@/lib/context";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { env } from "@/env.mjs";
import { prisma } from "@/server/db";

const TransformersApi = Function(
  'return import("langchain/embeddings/hf_transformers")',
)();
const { HuggingFaceTransformersEmbeddings } = await TransformersApi;

const fireworks = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: "https://api.fireworks.ai/inference/v1",
});

// export const runtime = "edge";
export async function POST(req: Request) {
  const { messages, docId } = await req.json();
  console.log(messages, docId, "this");

  const doc = await prisma.document.findFirst({
    where: {
      id: docId,
      // ownerId: userId,
    },
  });

  if (!doc) return new Response("Not found", { status: 404 });

  const embeddings = new HuggingFaceTransformersEmbeddings({
    // modelName: "jinaai/jina-embeddings-v2-small-en",
    modelName: "Xenova/all-MiniLM-L6-v2",
    stripNewLines: true,
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
  console.log(results, "embedding results");
  const prevMessages = await prisma.message.findMany({
    where: {
      documentId: docId as string,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 6,
  });

  const formattedPrevMessages = prevMessages.map((msg) => ({
    role: msg.isUserMessage ? ("user" as const) : ("assistant" as const),
    content: msg.text,
  }));

  const response = await fireworks.chat.completions.create({
    model: "accounts/fireworks/models/llama-v2-70b-chat",
    temperature: 0,
    stream: true,
    messages: [
      {
        role: "system",
        content:
          "Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format.",
      },
      {
        role: "user",
        content: `Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format. \nIf you don't know the answer, just say that you don't know, don't try to make up an answer.

  \n----------------\n

  PREVIOUS CONVERSATION:
  ${formattedPrevMessages.map((message) => {
    if (message.role === "user") return `User: ${message.content}\n`;
    return `Assistant: ${message.content}\n`;
  })}

  \n----------------\n

  CONTEXT:
  ${results.map((r) => r.pageContent).join("\n\n")}

  USER INPUT: ${lastMessage}`,
      },
    ],
  });

  // const stream = OpenAIStream(response, {
  //   async onCompletion(completion) {
  //     await db.message.create({
  //       data: {
  //         text: completion,
  //         isUserMessage: false,
  //         fileId,
  //         userId,
  //       },
  //     });
  //   },
  // });

  // // return new StreamingTextResponse(stream);

  // const prompt = {
  //   role: "system",
  //   content: `AI assistant is a brand new, powerful, human-like artificial intelligence.
  //   The traits of AI include expert knowledge, helpfulness, cleverness, and articulateness.
  //   AI is a well-behaved and well-mannered individual.
  //   AI is always friendly, kind, and inspiring, and he is eager to provide vivid and thoughtful responses to the user.
  //   AI has the sum of all knowledge in their brain, and is able to accurately answer nearly any question about any topic in conversation.
  //   AI assistant is a big fan of Pinecone and Vercel.
  //   START CONTEXT BLOCK
  //   ${results.map((r) => r.pageContent).join("\n\n")}
  //   END OF CONTEXT BLOCK
  //   AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
  //   If the context does not provide the answer to question, the AI assistant will say, "I'm sorry, but I don't know the answer to that question".
  //   AI assistant will not apologize for previous responses, but instead will indicated new information was gained.
  //   AI assistant will not invent anything that is not drawn directly from the context.
  //   `,
  // };

  // const response = await fireworks.chat.completions.create({
  //   model: "accounts/fireworks/models/llama-v2-70b-chat",
  //   stream: true,
  //   max_tokens: 1000,
  //   messages: [
  //     prompt,
  //     ...messages,
  //     // .filter((message: Message) => message.role === "user"),
  //   ],
  // });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}

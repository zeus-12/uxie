import { env } from "@/env.mjs";
import { fireworksOld as fireworks } from "@/lib/fireworks";
import { getPineconeClient } from "@/lib/pinecone";
import { generateDummyStream } from "@/lib/utils";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { HuggingFaceInferenceEmbeddings } from "langchain/embeddings/hf";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { getServerSession } from "next-auth";

export async function POST(req: Request, res: Response) {
  try {
    if (env.NODE_ENV === "development") {
      return generateDummyStream();
    } else {
      const { messages, docId } = await req.json();

      if (typeof docId !== "string")
        return new Response("Invalid document ID", { status: 400 });

      const session = await getServerSession(authOptions);
      if (!session) return new Response("Unauthorized", { status: 401 });

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

      if (!doc) return new Response("Document not found", { status: 404 });

      if (!doc.isVectorised) {
        throw new Error("Document not vectorized.");
      }

      const embeddings = new HuggingFaceInferenceEmbeddings({
        apiKey: env.HUGGINGFACE_API_KEY,
      });

      const pinecone = getPineconeClient();
      const pineconeIndex = pinecone.Index("uxie");

      const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex,
        filter: {
          fileId: docId,
        },
      });

      const lastMessage = messages[messages.length - 1].content;

      const results = await vectorStore.similaritySearch(lastMessage, 4);

      // const prevMessages = await prisma.message.findMany({
      //   where: {
      //     documentId: docId,
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

      const systemPrompt = `You are an AI assistant with access to a knowledge base. Your task is to provide accurate and helpful responses based on the given context.

    CONTEXT:
    ${results.map((r, i) => `[${i + 1}] ${r.pageContent}`).join("\n\n")}

    INSTRUCTIONS:
    1. Always base your answers on the provided context.
    2. If the context doesn't contain the information needed to answer the question, say "I don't have enough information to answer that question."
    3. Don't invent or assume information not present in the context.
    4. Use Markdown formatting for clarity, including headers, lists, and code blocks where appropriate.
    5. You do not need to be cautious or formal around me, nor should you remind me you are an AI model. I am already aware of this. 
    6. I need you to be detailed and precise, but I don’t need the fluff. Don’t bother with the “Sure, I can help with that” or similar statements.

    Answer the user's question thoughtfully and accurately based on the above context and instructions.`;

      const response = await fireworks.chat.completions.create({
        model: "accounts/fireworks/models/mixtral-8x7b-instruct",
        temperature: 0,
        stream: true,
        max_tokens: 4096,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...messages,
        ],
      });

      const stream = OpenAIStream(response, {
        onStart: async () => {
          await prisma.message.create({
            data: {
              text: messages[messages.length - 1].content,
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
  } catch (error) {
    console.error("Error in Chat function:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

import { env } from "@/env.mjs";
import { fireworks } from "@/lib/fireworks";
import { generateDummyStream } from "@/lib/utils";
import { retrieveRelevantDocumentContent } from "@/lib/vectorise";
import { chatRouteSchema } from "@/schema/routes";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { convertToCoreMessages, Message, streamText, tool } from "ai";
import { getServerSession } from "next-auth";
import { z } from "zod";

export const maxDuration = 30;

export async function POST(req: Request, res: Response) {
  try {
    if (env.NODE_ENV === "development") {
      return generateDummyStream();
    } else {
      const reqBody = await req.json();
      let { messages, docId } = chatRouteSchema.parse(reqBody);

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

      const prevMessage = messages[messages.length - 1] as Message;
      const isPreviousMessageToolInvoked =
        prevMessage.toolInvocations?.length &&
        prevMessage.toolInvocations?.length > 0;

      // don't add the user's message to the database if it was a tool invocation
      if (!isPreviousMessageToolInvoked) {
        await prisma.message.create({
          data: {
            text: messages[messages.length - 1].content,
            documentId: docId,
            userId: session?.user.id,
          },
        });
      }

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
      //   role: msg.userId ? ("user" as const) : ("assistant" as const),
      //   content: msg.text,
      // }));

      //   const systemPrompt = `You are an AI assistant with access to a knowledge base. Your task is to provide accurate and helpful responses based on the given context.

      // CONTEXT:
      // ${results.map((r, i) => `[${i + 1}] ${r.pageContent}`).join("\n\n")}

      // INSTRUCTIONS:
      // 1. Always base your answers on the provided context.
      // 2. If the context doesn't contain the information needed to answer the question, say "I don't have enough information to answer that question."
      // 3. Don't invent or assume information not present in the context.
      // 4. Use Markdown formatting for clarity, including headers, lists, and code blocks where appropriate.
      // 5. You do not need to be cautious or formal around me, nor should you remind me you are an AI model. I am already aware of this.
      // 6. I need you to be detailed and precise, but I don’t need the fluff. Don’t bother with the “Sure, I can help with that” or similar statements.

      // Answer the user's question thoughtfully and accurately based on the above context and instructions.`;

      const result = await streamText({
        model: fireworks("accounts/fireworks/models/firefunction-v1"),
        messages: convertToCoreMessages(messages),
        system: `You are a helpful assistant. Check your knowledge base before answering any questions.
        Only respond to questions using information from tool calls.
        if no relevant information is found in the tool calls, respond, "Sorry, I don't know."`,
        tools: {
          getInformation: tool({
            description: "Searching the PDF for relevant information",
            parameters: z.object({
              question: z.string().describe("the user's question"),
            }),
            execute: async ({ question }) =>
              retrieveRelevantDocumentContent(docId, question),
          }),
        },

        onFinish: async ({ text }) => {
          await prisma.message.create({
            data: {
              text,
              userId: session.user.id,
              documentId: docId,
            },
          });
        },
      });

      return result.toDataStreamResponse();
    }
  } catch (error) {
    console.error("Error in Chat function:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

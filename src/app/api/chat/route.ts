import { env } from "@/env.mjs";
import { generateDummyStream } from "@/lib/utils";
import { retrieveRelevantDocumentContent } from "@/lib/vectorise";
import { chatRouteSchema } from "@/schema/routes";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { google } from "@ai-sdk/google";
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

      const result = await streamText({
        model: google("gemini-2.0-flash"),
        messages: convertToCoreMessages(messages),
        system: `You are a helpful assistant with access to a PDF document. Your primary task is to answer questions based on the content of this PDF. Always check the PDF for information before responding, especially for specific details like author names, dates, or any factual content.
      You have access to a function called 'getInformation' that allows you to search the PDF. Use this function for every question, even if you think you might know the answer. This ensures accuracy and that your responses are always based on the actual content of the document.
      If the information isn't found in the PDF after searching, clearly state that the information couldn't be found in the document.
      Don't make up or assume any information. If you're unsure or if the information isn't in the PDF, say so. Remember, your goal is to provide accurate information from the PDF, not to guess or infer details that aren't explicitly stated.`,
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
              userId: null,
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

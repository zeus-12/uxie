import { retrieveRelevantDocumentContent } from "@/lib/vectorise";
import { chatRouteSchema } from "@/schema/routes";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { google } from "@ai-sdk/google";
import { type Message } from "@prisma/client";
import { convertToModelMessages, stepCountIs, streamText, tool } from "ai";
import { getServerSession } from "next-auth";
import { z } from "zod";

function getProperty(obj: object, key: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return undefined;
  // @ts-ignore - Safe property access after hasOwnProperty check
  return obj[key];
}

function isGetInformationInput(input: unknown): input is { question: string } {
  if (typeof input !== "object" || input === null) return false;
  return (
    "question" in input && typeof getProperty(input, "question") === "string"
  );
}

function isGetInformationOutput(output: unknown): output is {
  results: Array<{
    pageContent: string;
    metadata: Record<string, string | number>;
  }>;
} {
  if (typeof output !== "object" || output === null) return false;
  return "results" in output && Array.isArray(getProperty(output, "results"));
}

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const reqBody = await req.json();

    let { messages, docId } = chatRouteSchema.parse({
      ...reqBody,
      docId: reqBody.docId,
    });

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

    const prevMessage = messages[messages.length - 1];
    if (!prevMessage)
      return new Response("No previous message found", { status: 404 });

    const isPreviousMessageToolInvoked =
      prevMessage.toolInvocations?.length &&
      prevMessage.toolInvocations?.length > 0;

    // don't add the user's message to the database if it was a tool invocation
    if (!isPreviousMessageToolInvoked) {
      await prisma.message.create({
        data: {
          parts: prevMessage.parts,
          documentId: docId,
          userId: session?.user.id,
        },
      });
    }

    const result = streamText({
      model: google("gemini-2.5-flash"),
      messages: await convertToModelMessages(messages),
      system: SYSTEM_PROMPT,
      tools: AI_TOOLS({ docId }),
      toolChoice: "auto",
      stopWhen: stepCountIs(3),
      maxOutputTokens: 2000,
      onFinish: async ({ steps }) => {
        const parts: Message["parts"][] = [];

        for (const step of steps || []) {
          if (step.toolCalls && step.toolCalls.length > 0) {
            step.toolCalls.forEach((toolCall, index) => {
              if (isGetInformationInput(toolCall.input)) {
                parts.push({
                  type: `tool-${toolCall.toolName}`,
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  args: toolCall.input,
                });
              }

              const toolResult = step.toolResults?.[index];
              if (toolResult && isGetInformationOutput(toolResult.output)) {
                parts.push({
                  type: "tool-result",
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: toolResult.output,
                });
              }
            });
          }

          if (step.text) {
            parts.push({
              type: "text",
              text: step.text,
            });
          }
        }

        if (parts.length > 0) {
          await prisma.message.create({
            data: {
              parts,
              userId: null,
              documentId: docId,
            },
          });
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof Response && error.status === 429) {
      return new Response(
        "Rate limit exceeded. Please wait a little and try again soon.",
        { status: 429 },
      );
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

const SYSTEM_PROMPT = `You are a helpful assistant with access to a PDF document. Your primary task is to answer questions based on the content of this PDF.

WORKFLOW:
1. When a user asks a question, ALWAYS use the 'getInformation' function to search the PDF for relevant information
2. After receiving the search results, analyze the information and provide a comprehensive response based on what you found
3. Structure your response clearly and cite specific information from the document

IMPORTANT: 
- Use the getInformation function for every question, even if you think you might know the answer
- ALWAYS provide a detailed response after calling the function - don't just return the raw search results
- Base your answers entirely on the retrieved document content
- If the information isn't found in the PDF after searching, clearly state that the information couldn't be found in the document
- Don't make up or assume any information beyond what's explicitly stated in the retrieved content

Remember: Your goal is to be a helpful assistant that provides accurate, well-formatted responses based on the PDF content, not just a tool executor.`;

const AI_TOOLS = ({ docId }: { docId: string }) => ({
  getInformation: tool({
    description:
      "Search the PDF document for relevant information to answer the user's question. Call this function and then provide a comprehensive response based on the results.",
    inputSchema: z.object({
      question: z
        .string()
        .describe("the user's question or query about the PDF content"),
    }),
    execute: async ({ question }) => {
      const results = await retrieveRelevantDocumentContent(docId, question);

      return {
        results,
      };
    },
  }),
});

import { retrieveRelevantDocumentContent } from "@/lib/vectorise";
import { chatRouteSchema } from "@/schema/routes";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { google } from "@ai-sdk/google";
import { type Message } from "@prisma/client";
import {
  CHAT_SYSTEM_PROMPT,
  GET_INFORMATION_TOOL_DESCRIPTION,
  GET_INFORMATION_TOOL_NAME,
  getInformationInputSchema,
} from "@uxie/shared/lib/chat";
import { convertToModelMessages, stepCountIs, streamText, tool } from "ai";
import { getServerSession } from "next-auth";

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
      system: CHAT_SYSTEM_PROMPT,
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

const AI_TOOLS = ({ docId }: { docId: string }) => ({
  [GET_INFORMATION_TOOL_NAME]: tool({
    description: GET_INFORMATION_TOOL_DESCRIPTION,
    inputSchema: getInformationInputSchema,
    execute: async ({ question }) => {
      const results = await retrieveRelevantDocumentContent(docId, question);

      return {
        results,
      };
    },
  }),
});

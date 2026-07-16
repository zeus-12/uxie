import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { stepCountIs, streamText, tool } from "ai";
import {
  CHAT_SYSTEM_PROMPT,
  GET_INFORMATION_TOOL_DESCRIPTION,
  getInformationInputSchema,
} from "@uxie/shared/lib/chat";
import type { ChatMessage } from "../ipc-contract";
import { retrieve } from "./rag";

type ChatEvents = {
  onDelta: (text: string) => void;
  onRetrieving?: () => void;
  signal: AbortSignal;
};

// Runs the document chat with native tool-calling. The model decides when to
// call `getInformation`, whose `execute` runs the local embedding + sqlite-vec
// retrieval — the same agentic RAG loop the web app uses, just pointed at the
// on-device store and the configured OpenAI-compatible endpoint.
export async function runChat(
  docId: string,
  messages: ChatMessage[],
  events: ChatEvents,
): Promise<string> {
  const { llm } = await window.uxieAPI.getSettings();
  if (!llm.baseUrl || !llm.model) {
    throw new Error("LLM not configured — set a base URL and model in Settings.");
  }

  const provider = createOpenAICompatible({
    name: "uxie",
    baseURL: llm.baseUrl,
    apiKey: llm.apiKey || undefined,
  });

  console.log(
    `[chat] send docId=${docId} model=${llm.model} baseUrl=${llm.baseUrl} turns=${messages.length}`,
  );

  let toolCalls = 0;
  const result = streamText({
    model: provider(llm.model),
    system: CHAT_SYSTEM_PROMPT,
    messages,
    abortSignal: events.signal,
    stopWhen: stepCountIs(3),
    tools: {
      getInformation: tool({
        description: GET_INFORMATION_TOOL_DESCRIPTION,
        inputSchema: getInformationInputSchema,
        execute: async ({ question }) => {
          toolCalls++;
          const chunks = await retrieve(docId, question);
          console.log(
            `[chat] getInformation q=${JSON.stringify(question)} -> ${chunks.length} chunk(s)`,
          );
          chunks.forEach((c, i) =>
            console.log(`[chat]   chunk ${i + 1}: ${c.slice(0, 200)}`),
          );
          if (chunks.length === 0) {
            console.warn(
              "[chat] retrieval returned 0 chunks — is the document indexed?",
            );
          }
          return { results: chunks.map((pageContent) => ({ pageContent })) };
        },
      }),
    },
  });

  let full = "";
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      full += part.text;
      events.onDelta(part.text);
    } else if (part.type === "tool-call") {
      events.onRetrieving?.();
    } else if (part.type === "error") {
      console.error("[chat] stream error:", part.error);
      throw part.error instanceof Error
        ? part.error
        : new Error(String(part.error));
    }
  }

  if (toolCalls === 0) {
    console.warn(
      "[chat] model answered WITHOUT calling getInformation — answer is not grounded in the document. (Proxy tool-calling is best-effort.)",
    );
  }
  console.log(
    `[chat] done toolCalls=${toolCalls} answerLen=${full.length}`,
  );
  return full;
}

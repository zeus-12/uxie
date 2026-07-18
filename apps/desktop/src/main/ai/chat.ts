import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { smoothStream, stepCountIs, streamText, tool } from "ai";
import type { WebContents } from "electron";
import {
  CHAT_SYSTEM_PROMPT,
  GET_INFORMATION_TOOL_DESCRIPTION,
  getInformationInputSchema,
} from "@uxie/shared/lib/chat";
import type { ChatMessage } from "../../ipc-contract";
import { getSettings } from "../settings";

// Chat runs here (main), not the renderer, so the fetch stream is a real Node
// stream and deltas actually arrive incrementally — the same reason completion
// and flashcard evaluation live in main. Retrieval is the one bit that must stay
// in the renderer (the embedding model runs in its Web Worker), so the tool's
// execute round-trips to the renderer and back.

const controllers = new Map<string, AbortController>();

const retrievePending = new Map<string, (chunks: string[]) => void>();
let reqCounter = 0;

export function resolveChatRetrieve(
  reqId: string,
  chunks: string[] | null,
): void {
  const resolve = retrievePending.get(reqId);
  if (resolve) {
    retrievePending.delete(reqId);
    resolve(chunks ?? []);
  }
}

function retrieveViaRenderer(
  wc: WebContents,
  docId: string,
  question: string,
): Promise<string[]> {
  return new Promise((resolve) => {
    if (wc.isDestroyed()) return resolve([]);
    const reqId = `chat-retrieve-${++reqCounter}`;
    retrievePending.set(reqId, resolve);
    wc.send("chat:retrieve", reqId, docId, question);
    // Never hang the model on a lost reply.
    setTimeout(() => {
      if (retrievePending.delete(reqId)) resolve([]);
    }, 20_000);
  });
}

export function cancelChat(streamId: string): void {
  controllers.get(streamId)?.abort();
}

export async function streamChat(
  wc: WebContents,
  streamId: string,
  docId: string,
  messages: ChatMessage[],
): Promise<void> {
  const send = (channel: string, ...args: unknown[]) => {
    if (!wc.isDestroyed()) wc.send(channel, ...args);
  };

  const { llm } = getSettings();
  if (!llm.baseUrl || !llm.model) {
    send(
      "chat:error",
      streamId,
      "LLM not configured — set a base URL and model in Settings.",
    );
    return;
  }

  const provider = createOpenAICompatible({
    name: "uxie",
    baseURL: llm.baseUrl,
    apiKey: llm.apiKey || undefined,
  });

  const controller = new AbortController();
  controllers.set(streamId, controller);

  let full = "";
  try {
    const result = streamText({
      model: provider(llm.model),
      system: CHAT_SYSTEM_PROMPT,
      messages,
      abortSignal: controller.signal,
      stopWhen: stepCountIs(3),
      // The Claude-CLI-backed proxy emits the answer in a couple of huge chunks
      // rather than per token, so raw deltas look like "appears all at once".
      // smoothStream re-emits them word-by-word for a real typing feel.
      experimental_transform: smoothStream({ delayInMs: 12, chunking: "word" }),
      tools: {
        getInformation: tool({
          description: GET_INFORMATION_TOOL_DESCRIPTION,
          inputSchema: getInformationInputSchema,
          execute: async ({ question }) => {
            send("chat:retrieving", streamId);
            const chunks = await retrieveViaRenderer(wc, docId, question);
            return { results: chunks.map((pageContent) => ({ pageContent })) };
          },
        }),
      },
    });

    for await (const part of result.fullStream) {
      if (wc.isDestroyed()) return;
      if (part.type === "text-delta") {
        full += part.text;
        send("chat:delta", streamId, part.text);
      } else if (part.type === "error") {
        throw part.error instanceof Error
          ? part.error
          : new Error(String(part.error));
      }
    }
    send("chat:done", streamId, full);
  } catch (e) {
    // On cancel, keep whatever streamed so far; otherwise surface the error.
    if (controller.signal.aborted) {
      send("chat:done", streamId, full);
    } else {
      send("chat:error", streamId, e instanceof Error ? e.message : String(e));
    }
  } finally {
    controllers.delete(streamId);
  }
}

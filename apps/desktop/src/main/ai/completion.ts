import { streamText } from "ai";
import type { WebContents } from "electron";
import { getSettings } from "../settings";
import { llmModel } from "./provider";

const controllers = new Map<string, AbortController>();

export function cancelCompletion(streamId: string): void {
  controllers.get(streamId)?.abort();
}

// Same instruction as the web app's /api/completion route, folded into the user
// message — some endpoints reject role:"system".
const INSTRUCTION =
  "You are an AI writing assistant that continues existing text based on context from prior text. " +
  "Give more weight/priority to the later characters than the beginning ones. " +
  "Limit your response to no more than 200 characters, but make sure to construct complete sentences. " +
  "Only return the text that you generate, not the prompt. " +
  "Don't put quotes around the text, just return the text.";

export async function streamCompletion(
  wc: WebContents,
  streamId: string,
  prompt: string,
): Promise<void> {
  const send = (channel: string, ...args: unknown[]) => {
    if (!wc.isDestroyed()) wc.send(channel, ...args);
  };

  const { llm } = getSettings();
  if (!llm.baseUrl || !llm.model) {
    send(
      "completion:error",
      streamId,
      "LLM not configured — set a base URL and model in Settings.",
    );
    return;
  }

  const controller = new AbortController();
  controllers.set(streamId, controller);
  try {
    const result = streamText({
      model: llmModel(llm),
      abortSignal: controller.signal,
      temperature: 0.7,
      messages: [
        { role: "user", content: `${INSTRUCTION}\n\nContinue this text:\n${prompt}` },
      ],
    });
    for await (const part of result.fullStream) {
      if (wc.isDestroyed()) return;
      if (part.type === "text-delta") {
        send("completion:delta", streamId, part.text);
      } else if (part.type === "error") {
        const err = part.error;
        send(
          "completion:error",
          streamId,
          err instanceof Error ? err.message : String(err),
        );
        return;
      }
    }
    send("completion:done", streamId);
  } catch (e) {
    if (controller.signal.aborted) return;
    send("completion:error", streamId, e instanceof Error ? e.message : String(e));
  } finally {
    controllers.delete(streamId);
  }
}

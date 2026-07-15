import { streamText } from "ai";
import type { WebContents } from "electron";
import type { ChatMessage } from "../../ipc-contract";
import { getDb } from "../db";
import { createMessage } from "../db/messages";
import { getSettings } from "../settings";
import { llmModel } from "./provider";

const controllers = new Map<string, AbortController>();

export function cancelChat(streamId: string): void {
  controllers.get(streamId)?.abort();
}

const RAG_SYSTEM = (context: string) =>
  `You are a helpful assistant answering questions about a PDF document. Use the excerpts below to answer. If the answer isn't in them, say the document doesn't cover it — don't invent facts.

<document excerpts>
${context}
</document excerpts>`;

export async function streamChat(
  wc: WebContents,
  streamId: string,
  docId: string,
  messages: ChatMessage[],
  systemContext?: string,
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

  // Persist the just-sent user message.
  const lastUser = messages[messages.length - 1];
  if (lastUser?.role === "user") {
    await createMessage(getDb(), docId, "user", lastUser.content).catch(
      () => {},
    );
  }

  const controller = new AbortController();
  controllers.set(streamId, controller);
  try {
    const result = streamText({
      model: llmModel(llm),
      abortSignal: controller.signal,
      ...(systemContext ? { system: RAG_SYSTEM(systemContext) } : {}),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    // fullStream (not textStream) so provider/HTTP errors surface as parts
    // instead of being silently dropped.
    let assistantText = "";
    for await (const part of result.fullStream) {
      if (wc.isDestroyed()) return;
      if (part.type === "text-delta") {
        assistantText += part.text;
        send("chat:delta", streamId, part.text);
      } else if (part.type === "error") {
        const err = part.error;
        send(
          "chat:error",
          streamId,
          err instanceof Error ? err.message : String(err),
        );
        return;
      }
    }
    if (assistantText) {
      await createMessage(getDb(), docId, "assistant", assistantText).catch(
        () => {},
      );
    }
    send("chat:done", streamId);
  } catch (e) {
    if (controller.signal.aborted) return;
    send("chat:error", streamId, e instanceof Error ? e.message : String(e));
  } finally {
    controllers.delete(streamId);
  }
}

import type { AssistantModelMessage, ModelMessage, ToolModelMessage } from "ai";
import {
  GET_INFORMATION_TOOL_NAME,
  getInformationInputSchema,
  getInformationOutputSchema,
  type GetInformationInput,
  type GetInformationOutput,
} from "@uxie/shared/lib/chat";
import { chatPartsToRows, type ChatRow } from "@uxie/shared/lib/chat-rows";

export type ChatPart =
  | { type: "text"; text: string }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: typeof GET_INFORMATION_TOOL_NAME;
      input: GetInformationInput;
    }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: typeof GET_INFORMATION_TOOL_NAME;
      output: GetInformationOutput;
    };

export interface ChatMessage {
  role: "user" | "assistant";
  parts: ChatPart[];
}

export function textPart(text: string): ChatPart {
  return { type: "text", text };
}

export function chatMessageText(message: ChatMessage): string {
  return message.parts
    .filter(
      (part): part is Extract<ChatPart, { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

export function chatMessageToRows(message: ChatMessage): ChatRow[] {
  return chatPartsToRows(message.role, message.parts);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGetInformationInput(value: unknown): value is GetInformationInput {
  return (
    isRecord(value) &&
    typeof value.question === "string" &&
    Object.keys(value).every((key) => key === "question")
  );
}

function isGetInformationOutput(value: unknown): value is GetInformationOutput {
  return getInformationOutputSchema.safeParse(value).success;
}

export function normalizeChatParts(parts: unknown): ChatPart[] {
  if (!Array.isArray(parts)) return [];
  return parts.flatMap((part): ChatPart[] => {
    if (!isRecord(part)) return [];
    if (part.type === "text" && "text" in part) {
      return [{ type: "text", text: String(part.text ?? "") }];
    }
    if (
      part.type === "tool-call" &&
      typeof part.toolCallId === "string" &&
      part.toolName === GET_INFORMATION_TOOL_NAME &&
      isGetInformationInput(part.input)
    ) {
      return [
        {
          type: "tool-call",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
        },
      ];
    }
    if (
      part.type === "tool-result" &&
      typeof part.toolCallId === "string" &&
      part.toolName === GET_INFORMATION_TOOL_NAME &&
      isGetInformationOutput(part.output)
    ) {
      return [
        {
          type: "tool-result",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output: part.output,
        },
      ];
    }
    return [];
  });
}

export function toChatToolCallPart({
  toolCallId,
  toolName,
  input,
}: {
  toolCallId: string;
  toolName: string;
  input: unknown;
}): ChatPart | null {
  if (toolName !== GET_INFORMATION_TOOL_NAME) return null;
  const parsed = getInformationInputSchema.safeParse(input);
  if (!parsed.success) return null;
  return {
    type: "tool-call",
    toolCallId,
    toolName,
    input: parsed.data,
  };
}

export function toChatToolResultPart({
  toolCallId,
  toolName,
  output,
}: {
  toolCallId: string;
  toolName: string;
  output: unknown;
}): ChatPart | null {
  if (
    toolName !== GET_INFORMATION_TOOL_NAME ||
    !isGetInformationOutput(output)
  ) {
    return null;
  }
  return { type: "tool-result", toolCallId, toolName, output };
}

export function completedChatParts(parts: ChatPart[]): ChatPart[] {
  const callIds = new Set(
    parts
      .filter(
        (part): part is Extract<ChatPart, { type: "tool-call" }> =>
          part.type === "tool-call",
      )
      .map((part) => part.toolCallId),
  );
  const resultIds = new Set(
    parts
      .filter(
        (part): part is Extract<ChatPart, { type: "tool-result" }> =>
          part.type === "tool-result",
      )
      .map((part) => part.toolCallId),
  );

  return parts.filter(
    (part) =>
      part.type === "text" ||
      (callIds.has(part.toolCallId) && resultIds.has(part.toolCallId)),
  );
}

export function chatMessagesToModelMessages(
  messages: ChatMessage[],
): ModelMessage[] {
  const result: ModelMessage[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      result.push({ role: "user", content: chatMessageText(message) });
      continue;
    }

    let text = "";
    let calls: Array<Extract<ChatPart, { type: "tool-call" }>> = [];
    let toolResults: Array<Extract<ChatPart, { type: "tool-result" }>> = [];

    const flushText = () => {
      if (!text) return;
      result.push({ role: "assistant", content: text });
      text = "";
    };
    const flushCalls = () => {
      if (!calls.length) return;
      const content: AssistantModelMessage["content"] = calls.map((call) => ({
        type: "tool-call",
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        input: call.input,
      }));
      result.push({
        role: "assistant",
        content,
      });
      calls = [];
    };
    const flushResults = () => {
      if (!toolResults.length) return;
      const content: ToolModelMessage["content"] = toolResults.map(
        (toolResult) => ({
          type: "tool-result",
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.toolName,
          output: { type: "json", value: toolResult.output },
        }),
      );
      result.push({
        role: "tool",
        content,
      });
      toolResults = [];
    };

    for (const part of completedChatParts(message.parts)) {
      if (part.type === "text") {
        flushCalls();
        flushResults();
        text += part.text;
      } else if (part.type === "tool-call") {
        flushText();
        flushResults();
        calls.push(part);
      } else {
        flushText();
        flushCalls();
        toolResults.push(part);
      }
    }
    flushText();
    flushCalls();
    flushResults();
  }

  return result;
}

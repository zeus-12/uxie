import type {
  AssistantModelMessage,
  ModelMessage,
  ToolModelMessage,
  UserModelMessage,
} from "ai";
import {
  GET_INFORMATION_TOOL_NAME,
  getInformationInputSchema,
  type GetInformationInput,
  type RetrievedChunk,
} from "@uxie/shared/lib/chat";
import {
  attachmentFromDataUrl,
  type ChatImageAttachment,
} from "@uxie/shared/lib/chat-attachments";

type GetInformationOutput = { results: RetrievedChunk[] };

export type ChatPart =
  | { type: "text"; text: string }
  | {
      type: "file";
      filename: string;
      mediaType: ChatImageAttachment["mediaType"];
      url: string;
    }
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

export type ChatDisplayRow =
  | {
      kind: "message";
      role: "user" | "assistant";
      content: string;
      attachments?: ChatImageAttachment[];
    }
  | { kind: "tool"; label: string; active: false };

export function textPart(text: string): ChatPart {
  return { type: "text", text };
}

export function imagePart(attachment: ChatImageAttachment): ChatPart {
  return {
    type: "file",
    filename: attachment.filename,
    mediaType: attachment.mediaType,
    url: attachment.url,
  };
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

export function chatMessageToRows(message: ChatMessage): ChatDisplayRow[] {
  if (message.role === "user") {
    const attachments = message.parts.flatMap(
      (part, index): ChatImageAttachment[] => {
        if (part.type !== "file") return [];
        const result = attachmentFromDataUrl({
          url: part.url,
          filename: part.filename,
          id: `attachment-${index}`,
        });
        return result.kind === "attachment" ? [result.attachment] : [];
      },
    );
    const content = chatMessageText(message);
    return content.trim() || attachments.length
      ? [
          {
            kind: "message",
            role: "user",
            content,
            attachments,
          },
        ]
      : [];
  }

  const rows: ChatDisplayRow[] = [];
  for (const part of message.parts) {
    if (part.type === "tool-call") {
      rows.push({
        kind: "tool",
        label: "Searched the document",
        active: false,
      });
    } else if (part.type === "text" && part.text.trim()) {
      rows.push({
        kind: "message",
        role: message.role,
        content: part.text,
      });
    }
  }
  return rows;
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

function isRetrievedChunk(value: unknown): value is RetrievedChunk {
  if (!isRecord(value) || typeof value.pageContent !== "string") return false;
  if (value.metadata === undefined) return true;
  return (
    isRecord(value.metadata) &&
    Object.values(value.metadata).every(
      (item) => typeof item === "string" || typeof item === "number",
    )
  );
}

function isGetInformationOutput(value: unknown): value is GetInformationOutput {
  return (
    isRecord(value) &&
    Array.isArray(value.results) &&
    value.results.every(isRetrievedChunk)
  );
}

export function normalizeChatParts(parts: unknown): ChatPart[] {
  if (!Array.isArray(parts)) return [];
  return parts.flatMap((part): ChatPart[] => {
    if (!isRecord(part)) return [];
    if (part.type === "text" && "text" in part) {
      return [{ type: "text", text: String(part.text ?? "") }];
    }
    if (
      part.type === "file" &&
      typeof part.filename === "string" &&
      typeof part.url === "string"
    ) {
      const result = attachmentFromDataUrl({
        url: part.url,
        filename: part.filename,
      });
      if (result.kind === "attachment") {
        return [imagePart(result.attachment)];
      }
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
      part.type === "file" ||
      (callIds.has(part.toolCallId) && resultIds.has(part.toolCallId)),
  );
}

export function chatMessagesToModelMessages(
  messages: ChatMessage[],
): ModelMessage[] {
  const result: ModelMessage[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      const imageParts = message.parts.filter(
        (part): part is Extract<ChatPart, { type: "file" }> =>
          part.type === "file",
      );
      if (!imageParts.length) {
        result.push({ role: "user", content: chatMessageText(message) });
        continue;
      }

      const content: UserModelMessage["content"] = [];
      const text = chatMessageText(message);
      if (text) content.push({ type: "text", text });
      for (const part of imageParts) {
        content.push({
          type: "image",
          image: part.url,
          mediaType: part.mediaType,
        });
      }
      result.push({ role: "user", content });
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
      } else if (part.type === "tool-result") {
        flushText();
        flushCalls();
        toolResults.push(part);
      } else {
        flushText();
        flushCalls();
        flushResults();
      }
    }
    flushText();
    flushCalls();
    flushResults();
  }

  return result;
}

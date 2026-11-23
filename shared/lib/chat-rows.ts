import { GET_INFORMATION_TOOL_NAME, type CitationIndex } from "./chat";
import type { ChatImage } from "./chat-attachments";

export type ChatRole = "user" | "assistant";

export type ChatRow =
  | {
      kind: "message";
      role: ChatRole;
      content: string;
      attachments?: ChatImage[];
      citations?: CitationIndex;
    }
  | { kind: "streaming"; content: string; citations?: CitationIndex }
  | { kind: "tool"; label: string; active: boolean }
  | { kind: "thinking"; label: string }
  | { kind: "error"; content: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function chatPartsToRows(
  role: string,
  parts: unknown,
  citations?: CitationIndex,
): ChatRow[] {
  if (!Array.isArray(parts)) return [];
  const displayRole: ChatRole = role === "user" ? "user" : "assistant";
  const rows: ChatRow[] = [];

  for (const part of parts) {
    if (!isRecord(part) || typeof part.type !== "string") continue;
    if (part.type === "text") {
      if (typeof part.text === "string" && part.text.trim()) {
        rows.push({
          kind: "message",
          role: displayRole,
          content: part.text,
          ...(displayRole === "assistant" && citations?.size
            ? { citations }
            : {}),
        });
      }
      continue;
    }

    const isDesktopToolCall =
      part.type === "tool-call" && part.toolName === GET_INFORMATION_TOOL_NAME;
    const isWebToolCall = part.type === `tool-${GET_INFORMATION_TOOL_NAME}`;
    const isLegacyWebToolCall =
      part.type === "tool-invocation" &&
      isRecord(part.toolInvocation) &&
      part.toolInvocation.toolName === GET_INFORMATION_TOOL_NAME;
    if (!isDesktopToolCall && !isWebToolCall && !isLegacyWebToolCall) continue;

    const active =
      typeof part.state === "string" &&
      part.state !== "output-available" &&
      part.state !== "output-error";
    rows.push({
      kind: "tool",
      label: active ? "Searching the document…" : "Searched the document",
      active,
    });
  }

  return rows;
}

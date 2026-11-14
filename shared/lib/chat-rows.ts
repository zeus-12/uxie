import {
  GET_INFORMATION_TOOL_NAME,
  retrievedChunksFromParts,
  type RetrievedChunk,
} from "./chat";

export type ChatRole = "user" | "assistant";

export type ChatRow =
  | {
      kind: "message";
      role: ChatRole;
      content: string;
      sources?: RetrievedChunk[];
    }
  | { kind: "streaming"; content: string }
  | { kind: "tool"; label: string; active: boolean }
  | { kind: "thinking"; label: string }
  | { kind: "error"; content: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Converts every app's native message parts into the shared visual model. */
export function chatPartsToRows(role: string, parts: unknown): ChatRow[] {
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
        });
      }
      continue;
    }

    const isDesktopToolCall =
      part.type === "tool-call" && part.toolName === GET_INFORMATION_TOOL_NAME;
    const isWebToolCall = part.type === `tool-${GET_INFORMATION_TOOL_NAME}`;
    if (!isDesktopToolCall && !isWebToolCall) continue;

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

  const sources = retrievedChunksFromParts(parts);
  if (displayRole === "assistant" && sources.length > 0) {
    for (let index = rows.length - 1; index >= 0; index--) {
      const row = rows[index];
      if (row?.kind !== "message") continue;
      rows[index] = { ...row, sources };
      break;
    }
  }
  return rows;
}

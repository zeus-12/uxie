import { asc, eq } from "drizzle-orm";
import * as schema from "@uxie/shared/schema";
import { LOCAL_USER_ID, type DB } from "./client";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// role is derived from userId (user messages are owned; assistant messages are
// null), matching the web schema convention. Content is stored as a text part.
function partsToContent(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) =>
      p && typeof p === "object" && "text" in p
        ? String((p as { text?: unknown }).text ?? "")
        : "",
    )
    .join("");
}

export async function getMessagesByDocId(
  db: DB,
  documentId: string,
): Promise<StoredMessage[]> {
  const rows = await db
    .select()
    .from(schema.message)
    .where(eq(schema.message.documentId, documentId))
    .orderBy(asc(schema.message.createdAt));
  return rows.map((r) => ({
    id: r.id,
    role: r.userId ? "user" : "assistant",
    content: partsToContent(r.parts),
  }));
}

export async function createMessage(
  db: DB,
  documentId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await db.insert(schema.message).values({
    documentId,
    userId: role === "user" ? LOCAL_USER_ID : null,
    parts: [{ type: "text", text: content }],
  });
}

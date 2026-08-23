import { asc, eq } from "drizzle-orm";
import * as schema from "@uxie/shared/schema";
import {
  normalizeChatParts,
  type ChatMessage,
  type ChatPart,
} from "../../chat-messages";
import { LOCAL_USER_ID, type DB } from "./client";

export interface StoredMessage extends ChatMessage {
  id: string;
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
    parts: normalizeChatParts(r.parts),
  }));
}

export async function createMessage(
  db: DB,
  documentId: string,
  role: "user" | "assistant",
  parts: ChatPart[],
): Promise<void> {
  await db.insert(schema.message).values({
    documentId,
    userId: role === "user" ? LOCAL_USER_ID : null,
    parts,
  });
}

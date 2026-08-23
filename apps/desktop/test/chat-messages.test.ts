import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  chatMessageToRows,
  chatMessagesToModelMessages,
  completedChatParts,
  type ChatMessage,
} from "../src/chat-messages";
import {
  openDatabase,
  runMigrations,
  seedLocalUser,
} from "../src/main/db/client";
import { createDocument } from "../src/main/db/documents";
import { createMessage, getMessagesByDocId } from "../src/main/db/messages";

const MIGRATIONS = join(__dirname, "../drizzle");

const assistantTurn: ChatMessage = {
  role: "assistant",
  parts: [
    {
      type: "tool-call",
      toolCallId: "call-1",
      toolName: "getInformation",
      input: { question: "What does Figure 10.1 show?" },
    },
    {
      type: "tool-result",
      toolCallId: "call-1",
      toolName: "getInformation",
      output: {
        results: [{ pageContent: "Figure 10.1 shows a replicated log." }],
      },
    },
    { type: "text", text: "It shows a replicated operation log." },
  ],
};

describe("desktop chat message history", () => {
  it("persists tool activity and renders it after reload", async () => {
    const { db } = openDatabase(":memory:");
    runMigrations(db, MIGRATIONS);
    seedLocalUser(db);
    const document = await createDocument(db, {
      title: "Paper",
      url: "/paper.pdf",
      coverImageUrl: "/paper.png",
      pageCount: 12,
    });

    await createMessage(
      db,
      document.id,
      assistantTurn.role,
      assistantTurn.parts,
    );

    const [stored] = await getMessagesByDocId(db, document.id);
    expect(stored).toMatchObject(assistantTurn);
    expect(chatMessageToRows(stored)).toEqual([
      { kind: "tool", label: "Searched the document", active: false },
      {
        kind: "message",
        role: "assistant",
        content: "It shows a replicated operation log.",
      },
    ]);
  });

  it("replays stored tool calls and results to the model", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        parts: [{ type: "text", text: "What does Figure 10.1 show?" }],
      },
      assistantTurn,
      {
        role: "user",
        parts: [{ type: "text", text: "Did you search the document?" }],
      },
    ];

    expect(chatMessagesToModelMessages(messages)).toEqual([
      { role: "user", content: "What does Figure 10.1 show?" },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "getInformation",
            input: { question: "What does Figure 10.1 show?" },
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "getInformation",
            output: {
              type: "json",
              value: {
                results: [
                  { pageContent: "Figure 10.1 shows a replicated log." },
                ],
              },
            },
          },
        ],
      },
      {
        role: "assistant",
        content: "It shows a replicated operation log.",
      },
      { role: "user", content: "Did you search the document?" },
    ]);
  });

  it("drops an interrupted tool call that has no result", () => {
    expect(
      completedChatParts([
        {
          type: "tool-call",
          toolCallId: "interrupted",
          toolName: "getInformation",
          input: { question: "unfinished" },
        },
        { type: "text", text: "Partial answer" },
      ]),
    ).toEqual([{ type: "text", text: "Partial answer" }]);
  });
});

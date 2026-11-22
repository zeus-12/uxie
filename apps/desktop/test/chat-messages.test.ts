import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  chatMessageImageUrls,
  chatMessageToRows,
  chatMessagesToModelMessages,
  completedChatParts,
  normalizeChatParts,
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
        results: [
          {
            kind: "pdf",
            pageContent: "Figure 10.1 shows a replicated log.",
            pageNumber: 10,
          },
        ],
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
        sources: [
          {
            kind: "pdf",
            pageContent: "Figure 10.1 shows a replicated log.",
            pageNumber: 10,
          },
        ],
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

    expect(chatMessagesToModelMessages(messages, new Map())).toEqual([
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
                  {
                    kind: "pdf",
                    pageContent: "Figure 10.1 shows a replicated log.",
                    pageNumber: 10,
                  },
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

  it("persists, renders, and sends image attachments to the model", async () => {
    const imageUrl = "uxie-pdf://image/doc1/img1/jpeg";
    const imageBytes = new Uint8Array([0xff, 0xd8, 0xff]);
    const message: ChatMessage = {
      role: "user",
      parts: [
        { type: "text", text: "What does this diagram show?" },
        {
          type: "file",
          filename: "diagram.png",
          mediaType: "image/jpeg",
          url: imageUrl,
        },
      ],
    };

    const { db } = openDatabase(":memory:");
    runMigrations(db, MIGRATIONS);
    seedLocalUser(db);
    const document = await createDocument(db, {
      title: "Paper",
      url: "/paper.pdf",
      coverImageUrl: "/paper.png",
      pageCount: 12,
    });
    await createMessage(db, document.id, message.role, message.parts);

    const [stored] = await getMessagesByDocId(db, document.id);
    expect(stored).toMatchObject(message);
    expect(chatMessageToRows(stored)).toMatchObject([
      {
        kind: "message",
        role: "user",
        content: "What does this diagram show?",
        attachments: [{ filename: "diagram.png", url: imageUrl }],
      },
    ]);
    expect(chatMessageImageUrls([stored])).toEqual([imageUrl]);
    expect(
      chatMessagesToModelMessages([stored], new Map([[imageUrl, imageBytes]])),
    ).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "What does this diagram show?" },
          { type: "file", data: imageBytes, mediaType: "image/jpeg" },
        ],
      },
    ]);
    expect(() => chatMessagesToModelMessages([stored], new Map())).toThrow(
      imageUrl,
    );
  });

  it("sends image bytes only for the newest message", () => {
    const earlier: ChatMessage = {
      role: "user",
      parts: [
        { type: "text", text: "What is this?" },
        {
          type: "file",
          filename: "receipt.png",
          mediaType: "image/png",
          url: "uxie-pdf://image/doc1/gone",
        },
      ],
    };
    const followUp: ChatMessage = {
      role: "user",
      parts: [{ type: "text", text: "And the tip?" }],
    };
    const history = [
      earlier,
      { role: "assistant", parts: [{ type: "text", text: "A receipt." }] },
      followUp,
    ] satisfies ChatMessage[];

    expect(chatMessageImageUrls(history)).toEqual([]);
    expect(chatMessagesToModelMessages(history, new Map())).toEqual([
      {
        role: "user",
        content:
          "What is this?\n[The user attached an image here (receipt.png); it is not included in this turn.]",
      },
      { role: "assistant", content: "A receipt." },
      { role: "user", content: "And the tip?" },
    ]);
  });

  it("drops malformed stored image parts at the persistence boundary", () => {
    expect(
      normalizeChatParts([
        {
          type: "file",
          filename: "notes.txt",
          mediaType: "text/plain",
          url: "uxie-pdf://image/doc1/img1",
        },
        {
          type: "file",
          filename: "inline.png",
          mediaType: "image/png",
          url: "data:image/png;base64,aGVsbG8=",
        },
      ]),
    ).toEqual([]);
  });
});

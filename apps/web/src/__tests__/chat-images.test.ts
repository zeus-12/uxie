import {
  CHAT_REQUEST_ERRORS,
  chatErrorBody,
  chatErrorMessage,
  chatRequestBody,
  MAX_CHAT_REQUEST_BYTES,
  MAX_WEB_CHAT_IMAGE_TOTAL_BYTES,
  prepareChatMessages,
  withoutEarlierImageData,
} from "@/lib/chat-images";
import { sniffImageType } from "@uxie/shared/lib/chat-attachments";
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAAA";

const user = (parts: unknown[]) => ({ id: "u", role: "user", parts });

describe("chat images", () => {
  it("sends only the newest message's image bytes", () => {
    const messages = [
      user([
        { type: "text", text: "First" },
        { type: "file", mediaType: "image/png", filename: "a.png", url: PNG },
      ]),
      { id: "a", role: "assistant", parts: [{ type: "text", text: "Ok" }] },
      user([
        { type: "file", mediaType: "image/png", filename: "b.png", url: PNG },
      ]),
    ] as UIMessage[];

    expect(withoutEarlierImageData(messages)).toEqual([
      user([
        { type: "text", text: "First" },
        { type: "file", mediaType: "image/png", filename: "a.png" },
      ]),
      messages[1],
      messages[2],
    ]);
  });

  it("feeds the newest images to the model and stores only metadata", () => {
    const result = prepareChatMessages([
      user([{ type: "file", mediaType: "image/png", filename: "a.png" }]),
      user([
        { type: "text", text: "What is this?" },
        { type: "file", mediaType: "image/png", filename: "b.png", url: PNG },
      ]),
    ]);

    expect(result).toEqual({
      ok: true,
      messages: [
        user([
          {
            type: "text",
            text: "[The user attached an image here (a.png); it is not included in this turn.]",
          },
        ]),
        user([
          { type: "text", text: "What is this?" },
          { type: "file", mediaType: "image/png", filename: "b.png", url: PNG },
        ]),
      ],
      userMessageId: "u",
      userParts: [
        { type: "text", text: "What is this?" },
        { type: "file", mediaType: "image/png", filename: "b.png" },
      ],
    });
  });

  it("rejects image data in earlier messages", () => {
    expect(
      prepareChatMessages([
        user([{ type: "file", mediaType: "image/png", url: PNG }]),
        user([{ type: "text", text: "Hi" }]),
      ]).ok,
    ).toBe(false);
  });

  it("rejects unsupported, mismatched, remote and oversized images", () => {
    const bad = [
      {
        type: "file",
        mediaType: "image/svg+xml",
        url: "data:image/svg+xml;base64,PHN2Zy8+",
      },
      { type: "file", mediaType: "image/jpeg", url: PNG },
      {
        type: "file",
        mediaType: "image/png",
        url: "data:image/png;base64,/9j/4AAQSkZJ",
      },
      {
        type: "file",
        mediaType: "image/gif",
        url: "data:image/gif;base64,R0lGODlhAQAB",
      },
      {
        type: "file",
        mediaType: "image/png",
        url: "https://example.com/a.png",
      },
      {
        type: "file",
        mediaType: "image/png",
        url: `data:image/png;base64,iVBORw0KGgoA${"A".repeat(
          Math.ceil(((MAX_WEB_CHAT_IMAGE_TOTAL_BYTES + 3) * 4) / 3 / 4) * 4,
        )}`,
      },
      { type: "reasoning", text: "x" },
    ];
    for (const part of bad) {
      expect(prepareChatMessages([user([part])]).ok).toBe(false);
    }
  });

  it("rejects a newest message without a usable id", () => {
    expect(
      prepareChatMessages([
        { id: "../x", role: "user", parts: [{ type: "text", text: "hi" }] },
      ]),
    ).toEqual({ ok: false, error: "malformed" });
  });

  it("rejects more than four images in one message", () => {
    const image = { type: "file", mediaType: "image/png", url: PNG };
    expect(
      prepareChatMessages([user([image, image, image, image, image])]).ok,
    ).toBe(false);
    expect(prepareChatMessages([user([image, image, image, image])]).ok).toBe(
      true,
    );
  });
});

describe("sniffImageType", () => {
  const bytes = (base64: string) =>
    Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  it("reads the format from the bytes, not the name", () => {
    expect(sniffImageType(bytes("iVBORw0KGgoAAAAA"))).toBe("image/png");
    expect(sniffImageType(bytes("/9j/4AAQSkZJ"))).toBe("image/jpeg");
    expect(sniffImageType(bytes("UklGRiQAAABXRUJQVlA4"))).toBe("image/webp");
    expect(sniffImageType(bytes("R0lGODlhAQAB"))).toBe("image/gif");
    expect(sniffImageType(bytes("PHN2ZyB4bWxu"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("chat request shaping", () => {
  it("strips image bytes only from earlier user messages", () => {
    const assistantFile = {
      type: "file",
      mediaType: "image/png",
      url: "https://example.com/chart.png",
    };
    const messages = [
      user([
        { type: "file", mediaType: "image/png", filename: "a.png", url: PNG },
      ]),
      { id: "a", role: "assistant", parts: [assistantFile] },
      user([{ type: "text", text: "next" }]),
    ] as UIMessage[];

    const [earlier, assistant] = withoutEarlierImageData(
      messages,
    ) as UIMessage[];
    expect(earlier?.parts).toEqual([
      { type: "file", mediaType: "image/png", filename: "a.png" },
    ]);
    expect(assistant?.parts).toEqual([assistantFile]);
  });

  it("refuses to send a body over the request limit", () => {
    expect(chatRequestBody({ messages: [] })).toEqual({ messages: [] });
    expect(() =>
      chatRequestBody({ text: "x".repeat(MAX_CHAT_REQUEST_BYTES) }),
    ).toThrow(chatErrorBody("requestTooLarge"));
  });

  it("shows only the route's own error texts", () => {
    expect(chatErrorMessage(new Error(chatErrorBody("imageTooLarge")))).toBe(
      CHAT_REQUEST_ERRORS.imageTooLarge,
    );
    expect(chatErrorMessage(new Error('{"code":"toString"}'))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(chatErrorMessage(new Error("Internal Server Error"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(chatErrorMessage(undefined)).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

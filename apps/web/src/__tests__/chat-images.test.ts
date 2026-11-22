import {
  MAX_WEB_CHAT_IMAGE_TOTAL_BYTES,
  prepareChatMessages,
  withoutEarlierImageData,
} from "@/lib/chat-images";
import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

const PNG = "data:image/png;base64,aGVsbG8=";

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
            text: "[The user attached an image here (a.png); it is no longer available.]",
          },
        ]),
        user([
          { type: "text", text: "What is this?" },
          { type: "file", mediaType: "image/png", filename: "b.png", url: PNG },
        ]),
      ],
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
        url: "https://example.com/a.png",
      },
      {
        type: "file",
        mediaType: "image/png",
        url: `data:image/png;base64,${"A".repeat(
          Math.ceil(((MAX_WEB_CHAT_IMAGE_TOTAL_BYTES + 3) * 4) / 3 / 4) * 4,
        )}`,
      },
      { type: "reasoning", text: "x" },
    ];
    for (const part of bad) {
      expect(prepareChatMessages([user([part])]).ok).toBe(false);
    }
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

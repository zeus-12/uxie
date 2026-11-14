import {
  attachmentFromDataUrl,
  MAX_CHAT_IMAGE_BYTES,
} from "@uxie/shared/lib/chat-attachments";
import { describe, expect, it } from "vitest";

describe("chat image attachments", () => {
  it("constructs a supported image attachment from a data URL", () => {
    const result = attachmentFromDataUrl({
      filename: "figure.png",
      url: "data:image/png;base64,aGVsbG8=",
    });

    expect(result).toMatchObject({
      kind: "attachment",
      attachment: {
        filename: "figure.png",
        mediaType: "image/png",
        url: "data:image/png;base64,aGVsbG8=",
      },
    });
  });

  it("rejects unsupported and oversized images", () => {
    expect(
      attachmentFromDataUrl({
        filename: "figure.svg",
        url: "data:image/svg+xml;base64,PHN2Zy8+",
      }),
    ).toEqual({
      kind: "error",
      message: "Choose a PNG, JPEG, WebP, or GIF image.",
    });

    const oversizedBase64 = "A".repeat(
      Math.ceil(((MAX_CHAT_IMAGE_BYTES + 1) * 4) / 3),
    );
    expect(
      attachmentFromDataUrl({
        filename: "large.png",
        url: `data:image/png;base64,${oversizedBase64}`,
      }),
    ).toEqual({
      kind: "error",
      message: "Images must be 8 MB or smaller.",
    });
  });
});

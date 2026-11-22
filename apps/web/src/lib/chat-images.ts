import {
  earlierImagePlaceholder,
  isChatImageMediaType,
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_IMAGE_COUNT,
  sniffImageType,
  type ChatImageMediaType,
} from "@uxie/shared/lib/chat-attachments";
import type { UIMessage } from "ai";

// Vercel rejects function request bodies over 4.5 MB. Base64 inflates image
// bytes by 4/3, so 2.5 MiB of images leaves ~1 MB for the conversation's text.
export const MAX_WEB_CHAT_IMAGE_TOTAL_BYTES = 2.5 * 1024 * 1024;

export type StoredImagePart = {
  type: "file";
  mediaType: ChatImageMediaType;
  filename: string;
};
export type StoredUserPart = { type: "text"; text: string } | StoredImagePart;

type Prepared =
  | { ok: true; messages: UIMessage[]; userParts: StoredUserPart[] }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function base64Bytes(data: string): number | null {
  if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    return null;
  }
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

function inlineImageBytes(
  url: string,
  mediaType: ChatImageMediaType,
): number | null {
  const prefix = `data:${mediaType};base64,`;
  if (!url.startsWith(prefix)) return null;
  const data = url.slice(prefix.length);
  const size = base64Bytes(data);
  if (size === null) return null;
  const head = Uint8Array.from(atob(data.slice(0, 24)), (c) => c.charCodeAt(0));
  return sniffImageType(head) === mediaType ? size : null;
}

const imageName = (filename: unknown) =>
  typeof filename === "string" && filename.trim()
    ? filename.trim().slice(0, 200)
    : "image";

// Only the newest message carries image bytes; earlier images go up as
// metadata so a multi-image conversation stays under the request size limit.
export function withoutEarlierImageData(messages: UIMessage[]): unknown[] {
  return messages.map((message, index) =>
    index === messages.length - 1
      ? message
      : {
          ...message,
          parts: message.parts.map((part) =>
            part.type === "file"
              ? {
                  type: "file",
                  mediaType: part.mediaType,
                  filename: part.filename,
                }
              : part,
          ),
        },
  );
}

export function prepareChatMessages(messages: unknown[]): Prepared {
  const last = messages[messages.length - 1];
  if (!isRecord(last) || last.role !== "user") {
    return { ok: false, error: "The last message must come from the user." };
  }

  const prepared: unknown[] = [];
  let userParts: StoredUserPart[] = [];

  for (const [index, message] of messages.entries()) {
    if (!isRecord(message) || !Array.isArray(message.parts)) {
      return { ok: false, error: "Malformed message." };
    }
    if (message.role !== "user") {
      prepared.push(message);
      continue;
    }

    const isLatest = index === messages.length - 1;
    const modelParts: unknown[] = [];
    const storedParts: StoredUserPart[] = [];
    let imageCount = 0;
    let imageBytes = 0;

    for (const part of message.parts) {
      if (!isRecord(part)) return { ok: false, error: "Malformed part." };

      if (part.type === "text" && typeof part.text === "string") {
        modelParts.push({ type: "text", text: part.text });
        storedParts.push({ type: "text", text: part.text });
        continue;
      }
      if (part.type !== "file" || !isChatImageMediaType(part.mediaType)) {
        return {
          ok: false,
          error: "Only text and PNG, JPEG or WebP images can be sent.",
        };
      }

      const filename = imageName(part.filename);
      storedParts.push({ type: "file", mediaType: part.mediaType, filename });

      if (!isLatest) {
        if (part.url !== undefined) {
          return {
            ok: false,
            error: "Only the newest message can carry image data.",
          };
        }
        modelParts.push({
          type: "text",
          text: earlierImagePlaceholder(filename),
        });
        continue;
      }

      const bytes =
        typeof part.url === "string"
          ? inlineImageBytes(part.url, part.mediaType)
          : null;
      if (bytes === null) {
        return {
          ok: false,
          error: "An image isn't a valid PNG, JPEG or WebP file.",
        };
      }
      imageCount += 1;
      imageBytes += bytes;
      if (bytes > MAX_CHAT_IMAGE_BYTES) {
        return { ok: false, error: "An image is too large." };
      }
      modelParts.push({
        type: "file",
        mediaType: part.mediaType,
        filename,
        url: part.url,
      });
    }

    if (imageCount > MAX_CHAT_IMAGE_COUNT) {
      return { ok: false, error: "Too many images in one message." };
    }
    if (imageBytes > MAX_WEB_CHAT_IMAGE_TOTAL_BYTES) {
      return { ok: false, error: "The images in this message are too large." };
    }

    prepared.push({ ...message, parts: modelParts });
    if (isLatest) userParts = storedParts;
  }

  return { ok: true, messages: prepared as UIMessage[], userParts };
}

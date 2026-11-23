import {
  earlierImagePlaceholder,
  isChatImageMediaType,
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_IMAGE_COUNT,
  sniffImageType,
  type ChatImageMediaType,
} from "@uxie/shared/lib/chat-attachments";
import type { UIMessage } from "ai";

// Vercel rejects function request bodies over 4.5 MB.
export const MAX_CHAT_REQUEST_BYTES = 4_500_000;
export const MAX_WEB_CHAT_IMAGE_TOTAL_BYTES = 2.5 * 1024 * 1024;

export const CHAT_REQUEST_ERRORS = {
  lastNotUser: "The last message must come from the user.",
  malformed: "This message couldn't be read.",
  unsupportedPart: "Only text and PNG, JPEG or WebP images can be sent.",
  earlierImageData: "Only the newest message can carry image data.",
  invalidImage: "An image isn't a valid PNG, JPEG or WebP file.",
  imageTooLarge: "An image is too large.",
  tooManyImages: "Too many images in one message.",
  imagesTooLarge: "The images in this message are too large.",
  requestTooLarge:
    "This conversation is too large to send. Remove an image or shorten the message.",
  rateLimited: "Rate limit exceeded. Please wait a little and try again soon.",
} as const;

export type ChatErrorCode = keyof typeof CHAT_REQUEST_ERRORS;

const isChatErrorCode = (value: unknown): value is ChatErrorCode =>
  typeof value === "string" && Object.hasOwn(CHAT_REQUEST_ERRORS, value);

export const chatErrorBody = (code: ChatErrorCode) => JSON.stringify({ code });

export function chatErrorResponse(code: ChatErrorCode, status: number) {
  return new Response(chatErrorBody(code), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// The chat transport rejects with the response body as the error message.
export function chatErrorMessage(error: Error | undefined): string {
  let body: unknown;
  try {
    body = error ? JSON.parse(error.message) : undefined;
  } catch {
    body = undefined;
  }
  return isRecord(body) && isChatErrorCode(body.code)
    ? CHAT_REQUEST_ERRORS[body.code]
    : "Something went wrong. Please try again.";
}

export type StoredImagePart = {
  type: "file";
  mediaType: ChatImageMediaType;
  filename: string;
};
export type StoredUserPart = { type: "text"; text: string } | StoredImagePart;

type Prepared =
  | {
      ok: true;
      messages: UIMessage[];
      userMessageId: string;
      userParts: StoredUserPart[];
    }
  | { ok: false; error: ChatErrorCode };

const MESSAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;

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

export function withoutEarlierImageData(messages: UIMessage[]): unknown[] {
  return messages.map((message, index) =>
    index === messages.length - 1 || message.role !== "user"
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

export function chatRequestBody(body: Record<string, unknown>) {
  const size = new TextEncoder().encode(JSON.stringify(body)).byteLength;
  if (size > MAX_CHAT_REQUEST_BYTES) {
    throw new Error(chatErrorBody("requestTooLarge"));
  }
  return body;
}

export function prepareChatMessages(messages: unknown[]): Prepared {
  const last = messages[messages.length - 1];
  if (!isRecord(last) || last.role !== "user") {
    return { ok: false, error: "lastNotUser" };
  }
  if (typeof last.id !== "string" || !MESSAGE_ID.test(last.id)) {
    return { ok: false, error: "malformed" };
  }

  const prepared: unknown[] = [];
  let userParts: StoredUserPart[] = [];

  for (const [index, message] of messages.entries()) {
    if (!isRecord(message) || !Array.isArray(message.parts)) {
      return { ok: false, error: "malformed" };
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
      if (!isRecord(part)) return { ok: false, error: "malformed" };

      if (part.type === "text" && typeof part.text === "string") {
        modelParts.push({ type: "text", text: part.text });
        storedParts.push({ type: "text", text: part.text });
        continue;
      }
      if (part.type !== "file" || !isChatImageMediaType(part.mediaType)) {
        return {
          ok: false,
          error: "unsupportedPart",
        };
      }

      const filename = imageName(part.filename);
      storedParts.push({ type: "file", mediaType: part.mediaType, filename });

      if (!isLatest) {
        if (part.url !== undefined) {
          return {
            ok: false,
            error: "earlierImageData",
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
          error: "invalidImage",
        };
      }
      imageCount += 1;
      imageBytes += bytes;
      if (bytes > MAX_CHAT_IMAGE_BYTES) {
        return { ok: false, error: "imageTooLarge" };
      }
      modelParts.push({
        type: "file",
        mediaType: part.mediaType,
        filename,
        url: part.url,
      });
    }

    if (imageCount > MAX_CHAT_IMAGE_COUNT) {
      return { ok: false, error: "tooManyImages" };
    }
    if (imageBytes > MAX_WEB_CHAT_IMAGE_TOTAL_BYTES) {
      return { ok: false, error: "imagesTooLarge" };
    }

    prepared.push({ ...message, parts: modelParts });
    if (isLatest) userParts = storedParts;
  }

  return {
    ok: true,
    messages: prepared as UIMessage[],
    userMessageId: last.id,
    userParts,
  };
}

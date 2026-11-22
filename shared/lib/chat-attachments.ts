export const MAX_CHAT_IMAGE_COUNT = 4;
// Anthropic rejects images over 5 MB of base64; 3 MiB of bytes encodes to ~4.2 MB.
export const MAX_CHAT_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_CHAT_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_CHAT_IMAGE_EDGE = 1568;

export const CHAT_IMAGE_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type ChatImageMediaType = (typeof CHAT_IMAGE_MEDIA_TYPES)[number];
export type ChatImageSourceType = ChatImageMediaType | "image/gif";

export type ChatImage = {
  id: string;
  filename: string;
  url: string | null;
};

export function isChatImageMediaType(
  value: unknown,
): value is ChatImageMediaType {
  return CHAT_IMAGE_MEDIA_TYPES.some((mediaType) => mediaType === value);
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

export function sniffImageType(bytes: Uint8Array): ChatImageSourceType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) {
    return "image/webp";
  }
  if (
    startsWith(bytes, ascii("GIF87a")) ||
    startsWith(bytes, ascii("GIF89a"))
  ) {
    return "image/gif";
  }
  return null;
}

export function earlierImagePlaceholder(filename: string): string {
  return `[The user attached an image here (${filename}); it is not included in this turn.]`;
}

export function userMessageRows(content: string, attachments: ChatImage[]) {
  return content.trim() || attachments.length
    ? [
        {
          kind: "message" as const,
          role: "user" as const,
          content,
          attachments,
        },
      ]
    : [];
}

export const CHAT_IMAGE_COUNT_ERROR = `You can attach up to ${MAX_CHAT_IMAGE_COUNT} images.`;
export const CHAT_IMAGE_TYPE_ERROR = "Choose a PNG, JPEG, WebP, or GIF image.";

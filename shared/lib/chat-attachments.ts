import { createId } from "@paralleldrive/cuid2";

export const MAX_CHAT_IMAGE_COUNT = 4;
export const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024;

const CHAT_IMAGE_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type ChatImageMediaType = (typeof CHAT_IMAGE_MEDIA_TYPES)[number];

export type ChatImageAttachment = {
  id: string;
  filename: string;
  mediaType: ChatImageMediaType;
  url: string;
};

export type AttachmentResult =
  | { kind: "attachment"; attachment: ChatImageAttachment }
  | { kind: "error"; message: string };

export function isChatImageMediaType(
  value: string,
): value is ChatImageMediaType {
  return CHAT_IMAGE_MEDIA_TYPES.some((mediaType) => mediaType === value);
}

function dataUrlBytes(url: string): number | null {
  const commaIndex = url.indexOf(",");
  if (commaIndex === -1) return null;

  const metadata = url.slice(0, commaIndex);
  const data = url.slice(commaIndex + 1);
  if (!metadata.endsWith(";base64")) return null;

  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

export function attachmentFromDataUrl({
  url,
  filename,
  id,
}: {
  url: string;
  filename: string;
  id?: string;
}): AttachmentResult {
  const match = /^data:([^;,]+);base64,/i.exec(url);
  const mediaType = match?.[1]?.toLowerCase() ?? "";
  if (!isChatImageMediaType(mediaType)) {
    return {
      kind: "error",
      message: "Choose a PNG, JPEG, WebP, or GIF image.",
    };
  }

  const size = dataUrlBytes(url);
  if (size === null) {
    return { kind: "error", message: "This image couldn't be read." };
  }
  if (size > MAX_CHAT_IMAGE_BYTES) {
    return {
      kind: "error",
      message: "Images must be 8 MB or smaller.",
    };
  }

  return {
    kind: "attachment",
    attachment: {
      id: id ?? createId(),
      filename,
      mediaType,
      url,
    },
  };
}

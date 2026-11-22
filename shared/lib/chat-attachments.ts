export const MAX_CHAT_IMAGE_COUNT = 4;
// Anthropic rejects images over 5 MB of base64; 3 MiB of bytes encodes to ~4.2 MB.
export const MAX_CHAT_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_CHAT_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_CHAT_IMAGE_EDGE = 1568;

export const CHAT_IMAGE_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type ChatImageMediaType = (typeof CHAT_IMAGE_MEDIA_TYPES)[number];

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

export const CHAT_IMAGE_COUNT_ERROR = `You can attach up to ${MAX_CHAT_IMAGE_COUNT} images.`;
export const CHAT_IMAGE_TYPE_ERROR = "Choose a PNG, JPEG, WebP, or GIF image.";

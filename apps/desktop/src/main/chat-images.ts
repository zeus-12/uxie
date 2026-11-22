import {
  isChatImageMediaType,
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_IMAGE_COUNT,
  sniffImageType,
  type ChatImageMediaType,
} from "@uxie/shared/lib/chat-attachments";
import {
  textPart,
  type ChatImageUpload,
  type ChatPart,
  type CreateUserMessageResult,
} from "../chat-messages";
import { getDb } from "./db";
import { createMessage } from "./db/messages";
import { deleteDocumentImage, storeDocumentImage } from "./pdf";

type CheckedImage = ChatImageUpload & { mediaType: ChatImageMediaType };

function checkImages(
  images: ChatImageUpload[],
): { ok: true; images: CheckedImage[] } | { ok: false; error: string } {
  if (images.length > MAX_CHAT_IMAGE_COUNT) {
    return {
      ok: false,
      error: `You can attach up to ${MAX_CHAT_IMAGE_COUNT} images.`,
    };
  }
  const checked: CheckedImage[] = [];
  for (const image of images) {
    const mediaType = sniffImageType(image.bytes);
    if (!isChatImageMediaType(mediaType)) {
      return {
        ok: false,
        error: `${image.filename} is not a PNG, JPEG or WebP image.`,
      };
    }
    if (image.bytes.byteLength > MAX_CHAT_IMAGE_BYTES) {
      return { ok: false, error: `${image.filename} is too large.` };
    }
    checked.push({ ...image, mediaType });
  }
  return { ok: true, images: checked };
}

export async function createUserMessage(
  docId: string,
  text: string,
  images: ChatImageUpload[],
): Promise<CreateUserMessageResult> {
  const checked = checkImages(images);
  if (!checked.ok) return checked;

  const stored: string[] = [];
  try {
    const imageParts: ChatPart[] = [];
    for (const { filename, bytes, mediaType } of checked.images) {
      const url = await storeDocumentImage(docId, bytes, mediaType);
      stored.push(url);
      imageParts.push({ type: "file", filename, mediaType, url });
    }
    const parts = [...(text ? [textPart(text)] : []), ...imageParts];
    await createMessage(getDb(), docId, "user", parts);
    return { ok: true, message: { role: "user", parts } };
  } catch (error) {
    await Promise.allSettled(stored.map(deleteDocumentImage));
    throw error;
  }
}

import { useCallback, useState } from "react";
import {
  attachmentFromDataUrl,
  isChatImageMediaType,
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_IMAGE_COUNT,
  type AttachmentResult,
  type ChatImageAttachment,
} from "../lib/chat-attachments";

export {
  attachmentFromDataUrl,
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_IMAGE_COUNT,
  type ChatImageAttachment,
  type ChatImageMediaType,
} from "../lib/chat-attachments";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("This image couldn't be read."));
    reader.onerror = () => reject(new Error("This image couldn't be read."));
    reader.readAsDataURL(file);
  });
}

async function attachmentFromFile(file: File): Promise<AttachmentResult> {
  if (!isChatImageMediaType(file.type)) {
    return {
      kind: "error",
      message: "Choose a PNG, JPEG, WebP, or GIF image.",
    };
  }
  if (file.size > MAX_CHAT_IMAGE_BYTES) {
    return {
      kind: "error",
      message: `${file.name} is larger than 8 MB.`,
    };
  }

  try {
    const url = await readFileAsDataUrl(file);
    return attachmentFromDataUrl({ url, filename: file.name });
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error ? error.message : "This image couldn't be read.",
    };
  }
}

export function useChatImageAttachments() {
  const [attachments, setAttachments] = useState<ChatImageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const addDataUrl = useCallback((url: string, filename: string) => {
    const result = attachmentFromDataUrl({ url, filename });
    if (result.kind === "error") {
      setAttachmentError(result.message);
      return;
    }

    setAttachments((current) => {
      if (current.length >= MAX_CHAT_IMAGE_COUNT) {
        setAttachmentError("You can attach up to four images.");
        return current;
      }
      setAttachmentError(null);
      return [...current, result.attachment];
    });
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;

    const results = await Promise.all(files.map(attachmentFromFile));
    const valid = results.flatMap((result) =>
      result.kind === "attachment" ? [result.attachment] : [],
    );
    const firstError = results.find((result) => result.kind === "error");

    setAttachments((current) => {
      const available = MAX_CHAT_IMAGE_COUNT - current.length;
      const accepted = valid.slice(0, Math.max(0, available));
      if (valid.length > available) {
        setAttachmentError("You can attach up to four images.");
      } else {
        setAttachmentError(
          firstError?.kind === "error" ? firstError.message : null,
        );
      }
      return [...current, ...accepted];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((item) => item.id !== id));
    setAttachmentError(null);
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setAttachmentError(null);
  }, []);

  return {
    attachments,
    attachmentError,
    addDataUrl,
    addFiles,
    removeAttachment,
    clearAttachments,
  };
}

import {
  CHAT_IMAGE_TYPE_ERROR,
  sniffImageType,
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_IMAGE_EDGE,
  MAX_CHAT_IMAGE_SOURCE_BYTES,
  type ChatImageMediaType,
} from "./chat-attachments";

export type NormalizedChatImage = {
  blob: Blob;
  mediaType: ChatImageMediaType;
};

export type NormalizeResult =
  | { kind: "image"; image: NormalizedChatImage }
  | { kind: "error"; message: string };

const UNREADABLE = "This image couldn't be read.";

export function formatMegabytes(bytes: number): string {
  return `${Math.floor((bytes / 1024 / 1024) * 10) / 10} MB`;
}

function encode(
  canvas: HTMLCanvasElement,
  mediaType: ChatImageMediaType,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) => resolve(blob?.type === mediaType ? blob : null),
      mediaType,
      mediaType === "image/png" ? undefined : 0.9,
    ),
  );
}

function draw(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  background: string | null,
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

export async function normalizeChatImage(
  blob: Blob,
  name: string,
  maxBytes = MAX_CHAT_IMAGE_BYTES,
): Promise<NormalizeResult> {
  if (blob.size > MAX_CHAT_IMAGE_SOURCE_BYTES) {
    return {
      kind: "error",
      message: `${name} is larger than ${formatMegabytes(
        MAX_CHAT_IMAGE_SOURCE_BYTES,
      )}.`,
    };
  }

  const sourceType = sniffImageType(
    new Uint8Array(await blob.slice(0, 16).arrayBuffer()),
  );
  if (!sourceType) return { kind: "error", message: CHAT_IMAGE_TYPE_ERROR };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return { kind: "error", message: UNREADABLE };
  }

  try {
    const scale = Math.min(
      1,
      MAX_CHAT_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    if (scale === 1 && sourceType !== "image/gif" && blob.size <= maxBytes) {
      return {
        kind: "image",
        image: {
          blob: new Blob([blob], { type: sourceType }),
          mediaType: sourceType,
        },
      };
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const preferred: ChatImageMediaType =
      sourceType === "image/gif" ? "image/png" : sourceType;

    const canvas = draw(bitmap, width, height, null);
    const encoded = canvas && (await encode(canvas, preferred));
    if (encoded && encoded.size <= maxBytes) {
      return { kind: "image", image: { blob: encoded, mediaType: preferred } };
    }

    if (preferred !== "image/jpeg") {
      const flattened = draw(bitmap, width, height, "#ffffff");
      const jpeg = flattened && (await encode(flattened, "image/jpeg"));
      if (jpeg && jpeg.size <= maxBytes) {
        return {
          kind: "image",
          image: { blob: jpeg, mediaType: "image/jpeg" },
        };
      }
    }

    return {
      kind: "error",
      message: `${name} is still larger than ${formatMegabytes(
        maxBytes,
      )} after resizing.`,
    };
  } finally {
    bitmap.close();
  }
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]*)$/.exec(dataUrl);
  if (!match?.[1] || match[2] === undefined) return null;
  try {
    const binary = atob(match[2]);
    return new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))], {
      type: match[1],
    });
  } catch {
    return null;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error(UNREADABLE));
    reader.onerror = () => reject(new Error(UNREADABLE));
    reader.readAsDataURL(blob);
  });
}

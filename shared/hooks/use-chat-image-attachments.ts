import { createId } from "@paralleldrive/cuid2";
import { useCallback, useReducer } from "react";
import {
  CHAT_IMAGE_COUNT_ERROR,
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_IMAGE_COUNT,
  type ChatImage,
  type ChatImageMediaType,
} from "../lib/chat-attachments";
import {
  blobToDataUrl,
  dataUrlToBlob,
  formatMegabytes,
  normalizeChatImage,
} from "../lib/normalize-chat-image";

export type StagedChatImage = ChatImage & {
  url: string;
  mediaType: ChatImageMediaType;
  blob: Blob;
};

type Source = { blob: Blob; filename: string };

type Processed =
  | { kind: "image"; image: StagedChatImage }
  | { kind: "error"; message: string };

type State = {
  attachments: StagedChatImage[];
  error: string | null;
  pending: number;
};

type Action =
  | { type: "start"; count: number }
  | { type: "finish"; results: Processed[]; maxTotalBytes: number | null }
  | { type: "fail"; message: string }
  | { type: "remove"; id: string }
  | { type: "clear" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { ...state, pending: state.pending + action.count };
    case "finish": {
      const attachments = [...state.attachments];
      let totalBytes = attachments.reduce(
        (sum, item) => sum + item.blob.size,
        0,
      );
      let error: string | null = null;
      for (const result of action.results) {
        if (result.kind === "error") {
          error ??= result.message;
        } else if (attachments.length >= MAX_CHAT_IMAGE_COUNT) {
          error = CHAT_IMAGE_COUNT_ERROR;
        } else if (
          action.maxTotalBytes !== null &&
          totalBytes + result.image.blob.size > action.maxTotalBytes
        ) {
          error = `Images in one message can add up to ${formatMegabytes(
            action.maxTotalBytes,
          )}.`;
        } else {
          attachments.push(result.image);
          totalBytes += result.image.blob.size;
        }
      }
      return {
        attachments,
        error,
        pending: state.pending - action.results.length,
      };
    }
    case "fail":
      return { ...state, error: action.message };
    case "remove":
      return {
        ...state,
        attachments: state.attachments.filter((item) => item.id !== action.id),
        error: null,
      };
    case "clear":
      return { ...state, attachments: [], error: null };
  }
}

async function processSource(
  { blob, filename }: Source,
  maxBytes: number,
): Promise<Processed> {
  const result = await normalizeChatImage(blob, filename, maxBytes);
  if (result.kind === "error") return result;
  try {
    return {
      kind: "image",
      image: {
        id: createId(),
        filename,
        mediaType: result.image.mediaType,
        blob: result.image.blob,
        url: await blobToDataUrl(result.image.blob),
      },
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error ? error.message : "This image couldn't be read.",
    };
  }
}

export function useChatImageAttachments({
  maxTotalBytes = null,
}: { maxTotalBytes?: number | null } = {}) {
  const maxImageBytes = Math.min(
    MAX_CHAT_IMAGE_BYTES,
    maxTotalBytes ?? MAX_CHAT_IMAGE_BYTES,
  );
  const [state, dispatch] = useReducer(reducer, {
    attachments: [],
    error: null,
    pending: 0,
  });

  const addSources = useCallback(
    async (sources: Source[]) => {
      if (!sources.length) return;
      dispatch({ type: "start", count: sources.length });
      const results = await Promise.all(
        sources.map((source) => processSource(source, maxImageBytes)),
      );
      dispatch({ type: "finish", results, maxTotalBytes });
    },
    [maxImageBytes, maxTotalBytes],
  );

  const addFiles = useCallback(
    (files: File[]) =>
      addSources(files.map((file) => ({ blob: file, filename: file.name }))),
    [addSources],
  );

  const addDataUrl = useCallback(
    (dataUrl: string, filename: string) => {
      const blob = dataUrlToBlob(dataUrl);
      if (!blob) {
        dispatch({ type: "fail", message: "This image couldn't be read." });
        return Promise.resolve();
      }
      return addSources([{ blob, filename }]);
    },
    [addSources],
  );

  const removeAttachment = useCallback(
    (id: string) => dispatch({ type: "remove", id }),
    [],
  );
  const clearAttachments = useCallback(() => dispatch({ type: "clear" }), []);
  const setAttachmentError = useCallback(
    (message: string) => dispatch({ type: "fail", message }),
    [],
  );

  return {
    attachments: state.attachments,
    attachmentError: state.error,
    attachmentsPending: state.pending,
    addFiles,
    addDataUrl,
    removeAttachment,
    clearAttachments,
    setAttachmentError,
  };
}

import type { RetrievedChunk } from "@uxie/shared/lib/chat";

type RetrievedDocument = {
  pageContent: string;
  metadata: Record<string, unknown>;
};

export const toRetrievedChunks = (
  documents: readonly RetrievedDocument[],
): RetrievedChunk[] =>
  documents.map((document) => ({
    pageContent: document.pageContent,
    metadata: Object.fromEntries(
      Object.entries(document.metadata).filter(
        (entry): entry is [string, string | number] =>
          typeof entry[1] === "string" || typeof entry[1] === "number",
      ),
    ),
  }));

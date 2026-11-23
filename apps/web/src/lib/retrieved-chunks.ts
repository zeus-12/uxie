import {
  retrievedChunkSchema,
  type GetInformationOutput,
  type RetrievedChunk,
} from "@uxie/shared/lib/chat";

type RetrievedDocument = {
  pageContent: string;
  metadata: Record<string, unknown>;
};

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

// Legacy vectors only carry `loc.pageNumber` from pdf-parse, whose text doesn't match the viewer's text layer.
export function pageNumberFromMetadata(
  metadata: Record<string, unknown>,
): number | null {
  return positiveInteger(metadata.pageNumber);
}

export function toRetrievedChunk(
  document: RetrievedDocument,
): RetrievedChunk | null {
  const candidate =
    document.metadata.kind === "article"
      ? {
          kind: "article",
          pageContent: document.pageContent,
          blockId: document.metadata.blockId,
        }
      : document.metadata.kind === "pdf"
        ? {
            kind: "pdf",
            pageContent: document.pageContent,
            pageNumber: pageNumberFromMetadata(document.metadata),
          }
        : null;
  const parsed = retrievedChunkSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function toGetInformationOutput(
  documents: readonly RetrievedDocument[],
): GetInformationOutput {
  const results: RetrievedChunk[] = [];
  const unlocated: string[] = [];
  for (const document of documents) {
    const chunk = toRetrievedChunk(document);
    if (chunk) results.push(chunk);
    else if (document.pageContent.trim()) unlocated.push(document.pageContent);
  }
  return unlocated.length > 0 ? { results, unlocated } : { results };
}

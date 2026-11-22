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

// Pinecone stores metadata flat, so the PDF loader's nested `loc.pageNumber`
// comes back under the dotted key on vectors indexed before page provenance.
export function pageNumberFromMetadata(
  metadata: Record<string, unknown>,
): number | null {
  const location = metadata.loc;
  return (
    positiveInteger(metadata.pageNumber) ??
    positiveInteger(metadata["loc.pageNumber"]) ??
    (typeof location === "object" && location !== null
      ? positiveInteger((location as Record<string, unknown>).pageNumber)
      : null)
  );
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
      : {
          kind: "pdf",
          pageContent: document.pageContent,
          pageNumber: pageNumberFromMetadata(document.metadata),
        };
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

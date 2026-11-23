import { z } from "zod";

// Shared by web and desktop so both chats behave identically. Kept zod-only (no
// `ai` import) so it's usable regardless of which AI SDK major each app is on.
export const CHAT_SYSTEM_PROMPT = `You are a helpful assistant embedded in a document reader, helping the user with the document they are currently reading. You have a 'getInformation' tool that searches that document.

Call 'getInformation' ONLY when answering actually requires the document's contents, such as questions about what it says, its arguments, data, definitions, or specific passages. When you use it, search first, then write a clear answer grounded in the retrieved content.

Citations: every retrieved passage has a numeric 'ref'. Cite a passage inline as [ref:N] right after a claim it directly supports, e.g. "Traces are compiled to native code [ref:3]." or "[ref:2, 5]" for several. Plain bracketed numbers are reserved for the document's own references; never use them for passages. Cite only refs from tool results; a passage without a ref can't be cited, so don't mark it at all. Never mention refs or this citation format to the user. Never add a sources or references list at the end.

When the retrieved passages don't contain the answer, say so in one or two sentences and stop. Do not cite anything in that case and do not describe what the passages are about instead. For example: "The document doesn't discuss Python's global interpreter lock."

Do NOT call the tool for messages that don't need the document — greetings, small talk, thanks, or meta questions about you. Just reply directly and briefly.

Never dump raw search results; always respond in your own words, well-formatted. Don't invent document content you didn't retrieve.`;

export const GET_INFORMATION_TOOL_NAME = "getInformation";

export const GET_INFORMATION_TOOL_DESCRIPTION =
  "Search the document the user is reading for passages relevant to their question. Use this only when answering requires the document's actual contents, not for greetings or general chat.";

export const getInformationInputSchema = z.object({
  question: z
    .string()
    .describe("the user's question or query about the document content"),
});
export type GetInformationInput = z.infer<typeof getInformationInputSchema>;

export const pdfChunkSchema = z.object({
  kind: z.literal("pdf"),
  pageContent: z.string().min(1),
  pageNumber: z.number().int().positive(),
});
export const articleChunkSchema = z.object({
  kind: z.literal("article"),
  pageContent: z.string().min(1),
  blockId: z.string().min(1),
});
export const retrievedChunkSchema = z.discriminatedUnion("kind", [
  pdfChunkSchema,
  articleChunkSchema,
]);
const citationRefSchema = z.number().int().positive();
const resultChunkSchema = z.discriminatedUnion("kind", [
  pdfChunkSchema.extend({ ref: citationRefSchema.optional() }),
  articleChunkSchema.extend({ ref: citationRefSchema.optional() }),
]);
export type PdfChunk = z.infer<typeof pdfChunkSchema>;
export type ArticleChunk = z.infer<typeof articleChunkSchema>;
export type RetrievedChunk = z.infer<typeof retrievedChunkSchema>;

export type CitablePassage = RetrievedChunk & { ref: number };

// Passages from vectors indexed before provenance existed: the model reads them, the UI can't open them.
export const getInformationOutputSchema = z.object({
  results: z.array(resultChunkSchema),
  unlocated: z.array(z.string()).optional(),
});
export type GetInformationOutput = z.infer<typeof getInformationOutputSchema>;

export const pdfPageTextSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string(),
});
export type PdfPageText = z.infer<typeof pdfPageTextSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function outputFromPart(part: Record<string, unknown>): unknown {
  if (part.type === "tool-result") {
    return part.output ?? part.result;
  }
  if (part.type === `tool-${GET_INFORMATION_TOOL_NAME}`) {
    return part.output;
  }
  return undefined;
}

export type CitationIndex = ReadonlyMap<number, RetrievedChunk>;

export function citablePassagesFromParts(parts: unknown): CitablePassage[] {
  if (!Array.isArray(parts)) return [];
  return parts.flatMap((part): CitablePassage[] => {
    if (!isRecord(part)) return [];
    const parsed = getInformationOutputSchema.safeParse(outputFromPart(part));
    if (!parsed.success) return [];
    return parsed.data.results.flatMap(({ ref, ...chunk }) =>
      ref === undefined ? [] : [{ ...chunk, ref }],
    );
  });
}

// Web chats stored before refs were numbered against history restart at 1, so a later passage with the same ref wins.
export function withCitablePassages(
  index: CitationIndex,
  parts: unknown,
): CitationIndex {
  const passages = citablePassagesFromParts(parts);
  if (!passages.length) return index;
  const next = new Map(index);
  for (const { ref, ...chunk } of passages) next.set(ref, chunk);
  return next;
}

export function createCitationNumberer(
  history: readonly unknown[],
): (chunks: readonly RetrievedChunk[]) => CitablePassage[] {
  let nextRef =
    Math.max(
      0,
      ...history.flatMap((parts) =>
        citablePassagesFromParts(parts).map((passage) => passage.ref),
      ),
    ) + 1;
  return (chunks) => chunks.map((chunk) => ({ ...chunk, ref: nextRef++ }));
}

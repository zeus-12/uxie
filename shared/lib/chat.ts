import { z } from "zod";

// Shared by web and desktop so both chats behave identically. Kept zod-only (no
// `ai` import) so it's usable regardless of which AI SDK major each app is on.
export const CHAT_SYSTEM_PROMPT = `You are a helpful assistant embedded in a PDF reader, helping the user with the document they are currently reading. You have a 'getInformation' tool that searches that document.

Call 'getInformation' ONLY when answering actually requires the document's contents — questions about what the PDF says, its arguments, data, definitions, or specific passages. When you use it, search first, then write a clear answer grounded in the retrieved content. The reader attaches the exact retrieved passages and page numbers to your answer, so do not invent citation numbers or source links. If the answer isn't in the retrieved content, say so plainly.

Do NOT call the tool for messages that don't need the document — greetings, small talk, thanks, or meta questions about you. Just reply directly and briefly.

Never dump raw search results; always respond in your own words, well-formatted. Don't invent document content you didn't retrieve.`;

export const GET_INFORMATION_TOOL_NAME = "getInformation";

export const GET_INFORMATION_TOOL_DESCRIPTION =
  "Search the PDF the user is reading for passages relevant to their question. Use this only when answering requires the document's actual contents, not for greetings or general chit-chat.";

export const getInformationInputSchema = z.object({
  question: z
    .string()
    .describe("the user's question or query about the PDF content"),
});
export type GetInformationInput = z.infer<typeof getInformationInputSchema>;

// The shape each app's retrieval returns to the model and persists with the
// assistant turn. Page provenance is required: a chunk without it cannot power
// the reader's click-to-verify interaction and must be rejected at the boundary.
export const retrievedChunkSchema = z.object({
  pageContent: z.string().min(1),
  pageNumber: z.number().int().positive(),
});
export type RetrievedChunk = z.infer<typeof retrievedChunkSchema>;

export const getInformationOutputSchema = z.object({
  results: z.array(retrievedChunkSchema),
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

/**
 * Reads citations from desktop parts, live AI SDK web parts, and the older web
 * persistence shape. Invalid or legacy page-less chunks stay readable as chat
 * history but never become clickable citations.
 */
export function retrievedChunksFromParts(parts: unknown): RetrievedChunk[] {
  if (!Array.isArray(parts)) return [];

  const seen = new Set<string>();
  const chunks: RetrievedChunk[] = [];
  for (const part of parts) {
    if (!isRecord(part)) continue;
    const parsed = getInformationOutputSchema.safeParse(outputFromPart(part));
    if (!parsed.success) continue;

    for (const chunk of parsed.data.results) {
      const key = `${chunk.pageNumber}\u0000${chunk.pageContent}`;
      if (seen.has(key)) continue;
      seen.add(key);
      chunks.push(chunk);
    }
  }
  return chunks;
}

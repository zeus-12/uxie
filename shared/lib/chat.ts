import { z } from "zod";

// Shared by web and desktop so both chats behave identically. Kept zod-only (no
// `ai` import) so it's usable regardless of which AI SDK major each app is on.
export const CHAT_SYSTEM_PROMPT = `You are a helpful assistant embedded in a PDF reader, helping the user with the document they are currently reading. You have a 'getInformation' tool that searches that document.

Call 'getInformation' ONLY when answering actually requires the document's contents — questions about what the PDF says, its arguments, data, definitions, or specific passages. When you use it, search first, then write a clear answer grounded in and citing the retrieved content. If the answer isn't in the retrieved content, say so plainly.

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

// The shape each app's retrieval returns to the model.
export type RetrievedChunk = {
  pageContent: string;
  metadata?: Record<string, string | number>;
};

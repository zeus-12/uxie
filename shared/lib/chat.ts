import { z } from "zod";

// Byte-identical to the web app's chat system prompt so web and desktop behave
// the same. Kept zod-only (no `ai` import) so it's usable regardless of which
// AI SDK major each app is on.
export const CHAT_SYSTEM_PROMPT = `You are a helpful assistant with access to a PDF document. Your primary task is to answer questions based on the content of this PDF.

WORKFLOW:
1. When a user asks a question, ALWAYS use the 'getInformation' function to search the PDF for relevant information
2. After receiving the search results, analyze the information and provide a comprehensive response based on what you found
3. Structure your response clearly and cite specific information from the document

IMPORTANT:
- Use the getInformation function for every question, even if you think you might know the answer
- ALWAYS provide a detailed response after calling the function - don't just return the raw search results
- Base your answers entirely on the retrieved document content
- If the information isn't found in the PDF after searching, clearly state that the information couldn't be found in the document
- Don't make up or assume any information beyond what's explicitly stated in the retrieved content

Remember: Your goal is to be a helpful assistant that provides accurate, well-formatted responses based on the PDF content, not just a tool executor.`;

export const GET_INFORMATION_TOOL_NAME = "getInformation";

export const GET_INFORMATION_TOOL_DESCRIPTION =
  "Search the PDF document for relevant information to answer the user's question. Call this function and then provide a comprehensive response based on the results.";

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

import { z } from "zod";

export const chatRouteSchema = z.object({
  messages: z
    .array(z.any())
    .describe("The messages in the chat.")
    .min(1, "Messages must contain at least one message."),
  docId: z.string().describe("The document ID for the chat."),
});

export const completionRouteSchema = z.object({
  prompt: z.string().describe("The prompt for the completion."),
});

export const flashcardEvaluateRouteSchema = z.object({
  flashcardId: z.string().describe("The flashcard ID"),
  docId: z.string().describe("The document ID"),
  prompt: z.string().describe("The prompt for the evaluation."),
});

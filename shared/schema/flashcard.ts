import { z } from "zod";

// How close the user's response was. The model decides this — it is never
// inferred from which of the text fields came back, since all of them are
// always populated.
export const flashcardVerdictSchema = z.enum([
  "correct",
  "partial",
  "incorrect",
]);
export type FlashcardVerdict = z.infer<typeof flashcardVerdictSchema>;

export const flashcardFeedbackSchema = z.object({
  verdict: flashcardVerdictSchema.describe(
    'How close the response was: "correct", "partial", or "incorrect".',
  ),
  correctResponse: z.string().describe("What the user got right."),
  incorrectResponse: z.string().describe("What the user got wrong."),
  moreInfo: z.string().describe("More info about the response."),
});

export const flashcardSchema = z.object({
  question: z.string().describe("The question for the flashcard."),
  answer: z.string().describe("The answer for the flashcard."),
});

import { z } from "zod";

export const flashcardFeedbackSchema = z.object({
  correctResponse: z.string().describe("What the user got right."),
  incorrectResponse: z.string().describe("What the user got wrong."),
  moreInfo: z.string().describe("More info about the response."),
});

export const flashcardSchema = z.object({
  question: z.string().describe("The question for the flashcard."),
  answer: z.string().describe("The answer for the flashcard."),
});

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { z } from "zod";
import { flashcardFeedbackSchema } from "../schema/flashcard";
import { parseJsonLoose } from "./json";

// The same instruction the web app uses to generate flashcards.
export const FLASHCARD_GENERATE_INSTRUCTION = `You're using an advanced AI assistant capable of creating flashcards efficiently. Your task is to generate clear and concise question-answer pairs based on provided text.
Each question should have a straightforward answer and be self-contained. Limit your questions to a maximum of two per text segment. Avoid adding explanations or apologies. If you encounter difficulty creating a question, you can skip it.`;

export const flashcardSchema = z.object({
  question: z.string(),
  answer: z.string(),
});
export type GeneratedFlashcard = z.infer<typeof flashcardSchema>;

export const flashcardArraySchema = z.array(flashcardSchema);

// One definition, re-exported: web streams against it, desktop streams and
// parses against it. Two copies would drift.
export { flashcardFeedbackSchema };
export type FlashcardFeedbackData = z.infer<typeof flashcardFeedbackSchema>;

// Same splitter + config as the web app (langchain RecursiveCharacterTextSplitter
// 1000 / 200 overlap) so chunking is identical across web and desktop.
export async function chunkTextForFlashcards(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await splitter.splitText(text);
  return chunks
    .map((c) => c.replace(/\n/g, " ").trim())
    .filter((c) => c.length > 20);
}

// A prompt that asks for a raw JSON array. Unlike generateObject/streamObject
// this doesn't rely on the endpoint supporting `response_format`, so it works on
// providers (e.g. proxied Anthropic models) that don't implement JSON mode.
export function buildFlashcardGenerationPrompt(chunk: string): string {
  return `${FLASHCARD_GENERATE_INSTRUCTION}

Create question-answer pairs for the following text and return them as a JSON array.
Respond with ONLY the JSON array — no prose, no markdown code fences.
Each element must be an object with exactly two string fields: "question" and "answer".
If you cannot make any good question, respond with [].

Example: [{"question":"...","answer":"..."}]

Text:
${chunk}`;
}

// Shared by both apps so the meaning of a verdict can't drift between them.
export const FLASHCARD_FEEDBACK_INSTRUCTION = `Provide feedback for the user's response to a flashcard. Mention what they got right, highlight mistakes, then add relevant info about the correct answer.

Also judge how close the response was, as "verdict":
- "correct" — the response conveys the whole answer. Ignore spelling, casing, phrasing and extra detail.
- "partial" — the response gets an essential part right but misses or contradicts another: some items of a list, one component of a name, the right idea with a wrong detail.
- "incorrect" — nothing essential is right, the meaning is reversed, or the response is empty, off-topic, or an admission of not knowing.
A response that reverses or inverts the answer is never "correct", however confident it sounds.
Always include a verdict, and base it only on the user's response.

Leave "correctResponse" or "incorrectResponse" as an empty string when there is nothing to say for it — never write filler like "Nothing" or "N/A".`;

export function buildFlashcardFeedbackPrompt(input: {
  question: string;
  answer: string;
  userResponse: string;
}): string {
  return `${FLASHCARD_FEEDBACK_INSTRUCTION}

Respond with ONLY a JSON object — no prose, no markdown code fences — with exactly these fields: "verdict" (one of "correct", "partial", "incorrect"), "correctResponse", "incorrectResponse", "moreInfo" (strings).

<USER RESPONSE>${input.userResponse}</USER RESPONSE>
<QUESTION>${input.question}</QUESTION>
<CORRECT ANSWER>${input.answer}</CORRECT ANSWER>`;
}

export function parseFlashcards(text: string): GeneratedFlashcard[] {
  return flashcardArraySchema.parse(parseJsonLoose(text));
}

export function parseFlashcardFeedback(text: string): FlashcardFeedbackData {
  return flashcardFeedbackSchema.parse(parseJsonLoose(text));
}

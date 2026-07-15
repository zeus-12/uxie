import { generateText } from "ai";
import type { WebContents } from "electron";
import { eq } from "drizzle-orm";
import * as schema from "@uxie/shared/schema";
import {
  buildFlashcardFeedbackPrompt,
  buildFlashcardGenerationPrompt,
  chunkTextForFlashcards,
  parseFlashcardFeedback,
  parseFlashcards,
} from "@uxie/shared/lib/flashcards";
import { getDb } from "../db";
import { createFlashcardAttempt, createFlashcards } from "../db/flashcards";
import { extractPdfText } from "../pdf-text";
import { getSettings } from "../settings";
import { llmModel } from "./provider";

const MAX_CHUNKS = 30;

export async function generateFlashcardsForDoc(docId: string): Promise<number> {
  const { llm } = getSettings();
  if (!llm.baseUrl || !llm.model) {
    throw new Error("LLM not configured — set a base URL and model in Settings.");
  }

  const text = await extractPdfText(docId);
  const chunks = (await chunkTextForFlashcards(text)).slice(0, MAX_CHUNKS);
  const model = llmModel(llm);

  const cards: { question: string; answer: string }[] = [];
  let firstError: string | null = null;

  // Ask for a raw JSON array and parse it ourselves — the endpoint may not
  // support `response_format`, which is what generateObject relies on.
  // Small batches so we don't fire dozens of concurrent requests at once.
  const CONCURRENCY = 3;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((chunk) =>
        generateText({
          model,
          prompt: buildFlashcardGenerationPrompt(chunk),
        }).then((r) => parseFlashcards(r.text)),
      ),
    );
    for (const s of settled) {
      if (s.status === "fulfilled") cards.push(...s.value);
      else if (!firstError) {
        firstError =
          s.reason instanceof Error ? s.reason.message : String(s.reason);
      }
    }
  }

  // Surface a real error instead of silently returning 0 cards.
  if (cards.length === 0) {
    throw new Error(
      firstError
        ? `Flashcard generation failed: ${firstError}`
        : "The model returned no flashcards for this document.",
    );
  }
  return createFlashcards(getDb(), docId, cards);
}

export async function evaluateFlashcard(
  wc: WebContents,
  streamId: string,
  input: { flashcardId: string; prompt: string },
): Promise<void> {
  const send = (channel: string, ...args: unknown[]) => {
    if (!wc.isDestroyed()) wc.send(channel, ...args);
  };

  const { llm } = getSettings();
  if (!llm.baseUrl || !llm.model) {
    send(
      "flashcard:evaluate:error",
      streamId,
      "LLM not configured — set a base URL and model in Settings.",
    );
    return;
  }

  const [card] = await getDb()
    .select()
    .from(schema.flashcard)
    .where(eq(schema.flashcard.id, input.flashcardId));
  if (!card) {
    send("flashcard:evaluate:error", streamId, "Flashcard not found.");
    return;
  }

  try {
    // Plain text + JSON parse (not streamObject) so it works on endpoints
    // without `response_format` support.
    const { text } = await generateText({
      model: llmModel(llm),
      prompt: buildFlashcardFeedbackPrompt({
        question: card.question,
        answer: card.answer,
        userResponse: input.prompt,
      }),
    });
    if (wc.isDestroyed()) return;
    const feedback = parseFlashcardFeedback(text);
    await createFlashcardAttempt(getDb(), {
      flashcardId: input.flashcardId,
      userResponse: input.prompt,
      correctResponse: feedback.correctResponse,
      incorrectResponse: feedback.incorrectResponse,
      moreInfo: feedback.moreInfo,
    });
    send("flashcard:evaluate:done", streamId, feedback);
  } catch (e) {
    send(
      "flashcard:evaluate:error",
      streamId,
      e instanceof Error ? e.message : String(e),
    );
  }
}

import { generateText, streamObject } from "ai";
import type { WebContents } from "electron";
import { eq } from "drizzle-orm";
import * as schema from "@uxie/shared/schema";
import {
  buildFlashcardFeedbackPrompt,
  buildFlashcardGenerationPrompt,
  chunkTextForFlashcards,
  flashcardFeedbackSchema,
  parseFlashcardFeedback,
  parseFlashcards,
  type FlashcardFeedbackData,
} from "@uxie/shared/lib/flashcards";
import { getDb } from "../db";
import { createFlashcardAttempt, createFlashcards } from "../db/flashcards";
import { extractPdfText } from "../pdf-text";
import { getSettings } from "../settings";
import { llmModel } from "./provider";

export async function generateFlashcardsForDoc(docId: string): Promise<number> {
  const { llm } = getSettings();
  if (!llm.baseUrl || !llm.model) {
    throw new Error(
      "LLM not configured — set a base URL and model in Settings.",
    );
  }

  const text = await extractPdfText(docId);
  // No chunk cap: inference is local and user-owned.
  const chunks = await chunkTextForFlashcards(text);
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

  const model = llmModel(llm);
  const prompt = buildFlashcardFeedbackPrompt({
    question: card.question,
    answer: card.answer,
    userResponse: input.prompt,
  });

  try {
    let feedback: FlashcardFeedbackData;
    try {
      // Preferred path: stream the object so each field (right / wrong / more)
      // fills in as it arrives.
      const result = streamObject({
        model,
        schema: flashcardFeedbackSchema,
        prompt,
      });
      for await (const partial of result.partialObjectStream) {
        if (wc.isDestroyed()) return;
        send("flashcard:evaluate:delta", streamId, partial);
      }
      feedback = await result.object;
    } catch {
      // Fallback for endpoints without structured-output/JSON-mode support:
      // one non-streamed generation + tolerant parse (works everywhere).
      const { text } = await generateText({ model, prompt });
      feedback = parseFlashcardFeedback(text);
    }

    if (wc.isDestroyed()) return;
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

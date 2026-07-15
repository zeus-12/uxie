import { generateObject, streamObject } from "ai";
import type { WebContents } from "electron";
import { eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@uxie/shared/schema";
import { getDb } from "../db";
import { createFlashcardAttempt, createFlashcards } from "../db/flashcards";
import { extractPdfText } from "../pdf-text";
import { getSettings } from "../settings";
import { llmModel } from "./provider";

const MAX_CHUNKS = 30;

const GENERATE_PROMPT = `You create clear, concise question-answer flashcards from text. Each question must be self-contained with a straightforward answer. At most two per text segment. No explanations or apologies; skip a segment if you can't make a good question.`;

const feedbackSchema = z.object({
  correctResponse: z.string(),
  incorrectResponse: z.string(),
  moreInfo: z.string(),
});

function chunkText(text: string, size = 2000): string[] {
  const paras = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && (cur + p).length > size) {
      chunks.push(cur);
      cur = "";
    }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}

export async function generateFlashcardsForDoc(docId: string): Promise<number> {
  const { llm } = getSettings();
  if (!llm.baseUrl || !llm.model) {
    throw new Error("LLM not configured — set a base URL and model in Settings.");
  }

  const text = await extractPdfText(docId);
  const chunks = chunkText(text).slice(0, MAX_CHUNKS);
  console.log(
    `[flashcards] generate docId=${docId} textLen=${text.length} chunks=${chunks.length} model=${llm.model} baseUrl=${llm.baseUrl}`,
  );
  const model = llmModel(llm);
  const schema = z.object({
    cards: z.array(z.object({ question: z.string(), answer: z.string() })),
  });

  const cards: { question: string; answer: string }[] = [];
  let firstError: string | null = null;

  // Small batches so we don't fire dozens of concurrent requests at the endpoint.
  const CONCURRENCY = 3;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((chunk) =>
        generateObject({
          model,
          schema,
          // Fold the instruction into the prompt — some endpoints (e.g. Anthropic
          // proxies) reject role:"system" messages in the messages array.
          prompt: `${GENERATE_PROMPT}\n\nCreate question-answer pairs for the following text:\n\n${chunk}`,
        }).then((r) => r.object.cards),
      ),
    );
    for (const s of settled) {
      if (s.status === "fulfilled") cards.push(...s.value);
      else {
        console.error("[flashcards] chunk failed:", s.reason);
        if (!firstError) {
          firstError =
            s.reason instanceof Error ? s.reason.message : String(s.reason);
        }
      }
    }
  }

  console.log(`[flashcards] generated ${cards.length} cards`);
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

  const prompt = `Provide feedback for the user's response. Mention what they got right, highlight mistakes, then add relevant info about the correct answer.
<USER RESPONSE>${input.prompt}</USER RESPONSE>
<QUESTION>${card.question}</QUESTION>
<CORRECT ANSWER>${card.answer}</CORRECT ANSWER>`;

  try {
    const result = streamObject({
      model: llmModel(llm),
      schema: feedbackSchema,
      prompt,
    });
    for await (const partial of result.partialObjectStream) {
      if (wc.isDestroyed()) return;
      send("flashcard:evaluate:delta", streamId, partial);
    }
    const feedback = await result.object;
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

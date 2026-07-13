import { eq, inArray } from "drizzle-orm";
import * as schema from "@uxie/shared/schema";
import type { Flashcard, FlashcardAttempt } from "@uxie/shared/schema";
import { LOCAL_USER_ID, type DB } from "./client";

export type FlashcardWithAttempts = Flashcard & {
  flashcardAttempts: FlashcardAttempt[];
};

export async function getFlashcardsByDocId(
  db: DB,
  documentId: string,
): Promise<FlashcardWithAttempts[]> {
  const cards = await db
    .select()
    .from(schema.flashcard)
    .where(eq(schema.flashcard.documentId, documentId));

  const ids = cards.map((c) => c.id);
  const attempts = ids.length
    ? await db
        .select()
        .from(schema.flashcardAttempt)
        .where(inArray(schema.flashcardAttempt.flashcardId, ids))
    : [];

  return cards.map((c) => ({
    ...c,
    flashcardAttempts: attempts.filter((a) => a.flashcardId === c.id),
  }));
}

export async function createFlashcards(
  db: DB,
  documentId: string,
  cards: { question: string; answer: string }[],
): Promise<number> {
  if (cards.length === 0) return 0;
  await db
    .insert(schema.flashcard)
    .values(cards.map((c) => ({ ...c, documentId })));
  return cards.length;
}

export async function createFlashcardAttempt(
  db: DB,
  input: {
    flashcardId: string;
    userResponse: string;
    correctResponse?: string | null;
    incorrectResponse?: string | null;
    moreInfo?: string | null;
  },
): Promise<void> {
  await db.insert(schema.flashcardAttempt).values({
    flashcardId: input.flashcardId,
    userId: LOCAL_USER_ID,
    userResponse: input.userResponse,
    correctResponse: input.correctResponse ?? null,
    incorrectResponse: input.incorrectResponse ?? null,
    moreInfo: input.moreInfo ?? null,
  });
}

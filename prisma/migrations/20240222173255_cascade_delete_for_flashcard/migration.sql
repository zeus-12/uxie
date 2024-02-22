-- DropForeignKey
ALTER TABLE "FlashcardAttempt" DROP CONSTRAINT "FlashcardAttempt_flashcardId_fkey";

-- AddForeignKey
ALTER TABLE "FlashcardAttempt" ADD CONSTRAINT "FlashcardAttempt_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

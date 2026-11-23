import { prisma } from "@/server/db";
import {
  citablePassagesFromParts,
  type CitablePassage,
  type RetrievedChunk,
} from "@uxie/shared/lib/chat";

const UNSEEDED = 0;

async function seedFromStoredChat(documentId: string) {
  const { nextCitationRef } = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    select: { nextCitationRef: true },
  });
  if (nextCitationRef !== UNSEEDED) return;
  const stored = await prisma.message.findMany({
    where: { documentId, userId: null },
    select: { parts: true },
  });
  const highestRef = Math.max(
    0,
    ...stored.flatMap(({ parts }) =>
      citablePassagesFromParts(parts).map((passage) => passage.ref),
    ),
  );
  await prisma.document.updateMany({
    where: { id: documentId, nextCitationRef: UNSEEDED },
    data: { nextCitationRef: highestRef + 1 },
  });
}

export async function numberPassagesForDocument(
  documentId: string,
  chunks: readonly RetrievedChunk[],
): Promise<CitablePassage[]> {
  if (!chunks.length) return [];
  await seedFromStoredChat(documentId);
  const { nextCitationRef } = await prisma.document.update({
    where: { id: documentId },
    data: { nextCitationRef: { increment: chunks.length } },
    select: { nextCitationRef: true },
  });
  const firstRef = nextCitationRef - chunks.length;
  return chunks.map((chunk, index) => ({ ...chunk, ref: firstRef + index }));
}

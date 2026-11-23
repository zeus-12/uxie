import { prisma } from "@/server/db";
import type { CitablePassage, RetrievedChunk } from "@uxie/shared/lib/chat";

export async function numberPassagesForDocument(
  documentId: string,
  chunks: readonly RetrievedChunk[],
): Promise<CitablePassage[]> {
  if (!chunks.length) return [];
  const { nextCitationRef } = await prisma.document.update({
    where: { id: documentId },
    data: { nextCitationRef: { increment: chunks.length } },
    select: { nextCitationRef: true },
  });
  const firstRef = nextCitationRef - chunks.length;
  return chunks.map((chunk, index) => ({ ...chunk, ref: firstRef + index }));
}

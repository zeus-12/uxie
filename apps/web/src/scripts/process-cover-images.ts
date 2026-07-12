import { generateAndUploadCover } from "@/lib/pdf-cover";
import { prisma } from "@/server/db";

const BATCH_LIMIT = 20;

const script = async () => {
  const documents = await prisma.document.findMany({
    where: {
      coverImageUrl: "",
    },
    select: {
      id: true,
      url: true,
      title: true,
    },
    take: BATCH_LIMIT,
    orderBy: {
      createdAt: "asc",
    },
  });

  if (documents.length === 0) {
    console.log("No documents with missing cover images");
    return;
  }

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const doc of documents) {
    try {
      const response = await fetch(doc.url);

      if (!response.ok) {
        results.push({
          id: doc.id,
          success: false,
          error: `HTTP ${response.status}`,
        });
        continue;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/pdf")) {
        results.push({
          id: doc.id,
          success: false,
          error: `Invalid content-type: ${contentType}`,
        });
        continue;
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const coverImageUrl = await generateAndUploadCover(
        arrayBuffer,
        doc.title,
      );

      if (!coverImageUrl) {
        results.push({
          id: doc.id,
          success: false,
          error: "Cover generation returned undefined",
        });
        continue;
      }

      await prisma.document.update({
        where: { id: doc.id },
        data: { coverImageUrl },
      });

      results.push({ id: doc.id, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ id: doc.id, success: false, error: message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(
    `[cron/process-cover-images] Processed ${documents.length} documents: ${successCount} success, ${failCount} failed`,
  );

  if (failCount > 0) {
    console.log(
      "[cron/process-cover-images] Failures:",
      results.filter((r) => !r.success),
    );
  }
  console.log(`Processed ${documents.length} documents`);
};

script();

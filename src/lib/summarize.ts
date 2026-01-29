import { prisma } from "@/server/db";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const CHUNK_SIZE_FOR_SUMMARY = 8000;
const CHUNK_OVERLAP = 400;

const CHUNK_SUMMARY_PROMPT = (
  chunk: string,
) => `Summarize the following text chunk. Focus on key information, main points, and important details. Keep it concise (50-100 words).

Text chunk:
${chunk}

Summary:`;

const COMBINED_SUMMARY_PROMPT = (
  combinedSummaries: string,
) => `You have been given summaries of different sections of a document. Generate a comprehensive, cohesive summary of the entire document based on these section summaries.

The final summary should:
- Capture the main topics, themes, and key information across all sections
- Be detailed enough to provide context but concise (aim for 200-400 words)
- Include important concepts, findings, or conclusions mentioned
- Be written in clear, professional language
- Connect themes and ideas across sections

Section summaries:
${combinedSummaries}

Comprehensive document summary:`;

async function summarizeChunk(chunk: string): Promise<string> {
  const result = await generateText({
    model: google("gemini-2.5-flash"),
    prompt: CHUNK_SUMMARY_PROMPT(chunk),
    maxOutputTokens: 150,
  });

  return result.text.trim();
}

async function generateFinalSummary(
  intermediateSummaries: string[],
): Promise<string> {
  const combinedSummaries = intermediateSummaries.join("\n\n");

  const result = await generateText({
    model: google("gemini-2.5-flash"),
    prompt: COMBINED_SUMMARY_PROMPT(combinedSummaries),
    maxOutputTokens: 500,
  });

  return result.text.trim();
}

export async function generateDocumentSummary(
  fileUrl: string,
  docId: string,
): Promise<string> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.headers.get("content-type")?.includes("application/pdf")) {
      throw new Error("Invalid file type. Only PDFs are allowed.");
    }

    const blob = await response.blob();
    const loader = new PDFLoader(blob);
    const pageLevelDocs = await loader.load();
    const fullText = pageLevelDocs.map((doc) => doc.pageContent).join("\n\n");

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE_FOR_SUMMARY,
      chunkOverlap: CHUNK_OVERLAP,
    });

    const chunks = await textSplitter.splitText(fullText);

    const CONCURRENCY_LIMIT = 5;
    const intermediateSummaries: string[] = [];

    for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
      const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
      const batchSummaries = await Promise.all(
        batch.map((chunk) => summarizeChunk(chunk)),
      );
      intermediateSummaries.push(...batchSummaries);
    }

    let summariesToCombine = intermediateSummaries;

    if (intermediateSummaries.length > 10) {
      const metaSummaries: string[] = [];
      const META_BATCH_SIZE = 5;

      for (let i = 0; i < intermediateSummaries.length; i += META_BATCH_SIZE) {
        const batch = intermediateSummaries.slice(i, i + META_BATCH_SIZE);
        const combined = batch.join("\n\n");
        const metaSummary = await generateText({
          model: google("gemini-2.5-flash"),
          prompt: `Combine these section summaries into a single cohesive summary (100-150 words):

${combined}

Combined summary:`,
          maxOutputTokens: 200,
        });
        metaSummaries.push(metaSummary.text.trim());
      }

      summariesToCombine = metaSummaries;
    }

    const finalSummary = await generateFinalSummary(summariesToCombine);
    await prisma.document.update({
      where: { id: docId },
      data: { summary: finalSummary },
    });

    return finalSummary;
  } catch (error) {
    console.error("Error in generateDocumentSummary:", error);
    throw new Error("Failed to generate document summary");
  }
}

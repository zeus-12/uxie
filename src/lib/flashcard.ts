import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { z } from "zod";

const PROMPT = `You're using an advanced AI assistant capable of creating flashcards efficiently. Your task is to generate clear and concise question-answer pairs based on provided text.
Each question should have a straightforward answer and be self-contained. Limit your questions to a maximum of two per text segment. Avoid adding explanations or apologies. If you encounter difficulty creating a question, you can skip it.`;

export const generateFlashcards = async (
  fileUrl: string,
  maxPagesAllowed: number,
) => {
  const response = await fetch(fileUrl);
  const blob = await response.blob();
  const loader = new PDFLoader(blob);

  const pageLevelDocs = await loader.load();
  const pageCount = pageLevelDocs.length;

  if (pageCount > maxPagesAllowed) {
    throw new Error(
      `Document to generate flashcards can have at max ${maxPagesAllowed} pages. Upgrade to use larger documents.`,
    );
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const splitDocs = await textSplitter.splitDocuments(pageLevelDocs);
  const docContents = splitDocs.map((doc) => {
    return doc.pageContent.replace(/\n/g, " ");
  });

  const res = await Promise.allSettled(
    docContents.map(async (doc) => {
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        messages: [
          {
            role: "system",
            content: PROMPT,
          },
          {
            role: "user",
            content: `Create question-answer pairs for the following text:\n\n ${doc}`,
          },
        ],
        schema: z.array(
          z.object({
            question: z.string(),
            answer: z.string(),
          }),
        ),
      });
      return object;
    }),
  );

  const newRes: FlashcardType[] = res
    .map((item) => (item.status === "fulfilled" ? item.value : []))
    .flat();

  return newRes;
};

interface FlashcardType {
  question: string;
  answer: string;
}

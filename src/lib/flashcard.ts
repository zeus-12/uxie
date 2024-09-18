import { fireworksOld as fireworks } from "@/lib/fireworks";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

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
      return fireworks.chat.completions.create({
        model: "accounts/fireworks/models/mixtral-8x7b-instruct",
        max_tokens: 2048,

        messages: [
          {
            role: "system",
            content: `You're using an advanced AI assistant capable of creating flashcards efficiently. Your task is to generate clear and concise question-answer pairs based on provided text.
          Each question should have a straightforward answer and be self-contained. Limit your questions to a maximum of two per text segment. Avoid adding explanations or apologies. If you encounter difficulty creating a question, you can skip it.
          Please provide the output in JSON Array format, with each question as a key and its corresponding answer as the value. Strictly adhere to this format to ensure successful completion of the task.`,
          },
          {
            role: "user",
            content: `Create question-answer pairs for the following text:\n\n ${doc}`,
          },
        ],
      });
    }),
  );

  const newRes = res.map((item) =>
    item.status === "fulfilled"
      ? item.value.choices[0]?.message.content?.replaceAll("\n", "")
      : "",
  );

  const formatted = newRes.map((item) => {
    if (!item) {
      return "";
    }

    try {
      return JSON.parse(item);
    } catch (err: any) {
      console.log(err.message);
      return "";
    }
  });

  const flatArr: FlashcardType[] = formatted.flat().filter((item) => {
    if (!item.question || !item.answer) {
      return false;
    }
    return true;
  });
  return flatArr;
};

interface FlashcardType {
  question: string;
  answer: string;
}

import fireworks from "@/lib/fireworks";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export const generateFlashcards = async (fileUrl: string) => {
  const response = await fetch(fileUrl);
  const blob = await response.blob();
  const loader = new PDFLoader(blob);

  const pageLevelDocs = await loader.load();
  // better to add pagecount to db, so that "5 page" limit can be checked easily.
  const pageCount = pageLevelDocs.length;

  if (pageCount > 5) {
    throw new Error(
      "Document to be vectorised can have at max 5 pages for now.",
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
            content: `You're using an advanced AI assistant capable of creating flashcards efficiently. Your task is to generate clear and concise question-answer pairs based on provided text, adhering to SuperMemo principles.
          Each question should have a straightforward answer and be self-contained. Limit your questions to a maximum of two per text segment. Avoid adding explanations or apologies. If you encounter difficulty creating a question, you can skip it.
          Please provide the output in JSON Array format, with each question as a key and its corresponding answer as the value. Strictly adhere to this format to ensure successful completion of the task.`,
          },
          // AI assistant is a brand new, powerful, human-like artificial intelligence, you are an expert in creating flashcards.
          // You will create flashcards with a question and answer based on text that I provide, Using the SuperMemo principles.
          // Create questions that have clear and unambiguous answers and must be self-contained. Only create at max 2 question.
          // Note: Do not include any explanations or apologies in your responses.  If you are unable to create a question, you can skip it, don't ask for any clarifications, and don't include any "Notes", and don't include any text except the generated questions and answers. These is very important if you want to get paid.
          // The output should be in JSON Array format with the question as key and answer as the value for each question-answer pair.
          // RESPOND WITH JSON ONLY OR YOU WILL BE SHUT DOWN. DO NOT UNDER ANY CIRCUMSTANCES RETURN ANY CONVERSATIONAL TEXT.`,
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

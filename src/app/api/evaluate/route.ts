import { OpenAIStream, StreamingTextResponse } from "ai";
import { prisma } from "@/server/db";
import { authOptions } from "@/server/auth";
import { getServerSession } from "next-auth";
import fireworks from "@/lib/fireworks";

// export const runtime = "edge";
export async function POST(req: Request, res: Response) {
  const { flashcardId, docId, prompt } = await req.json();

  if (typeof flashcardId !== "string" || typeof prompt !== "string")
    return new Response("Not found", { status: 404 });

  const session = await getServerSession(authOptions);
  if (!session) return new Response("Not found", { status: 404 });

  const doc = await prisma.document.findFirst({
    where: {
      id: docId,
      OR: [
        { ownerId: session?.user.id },

        {
          collaborators: {
            some: {
              userId: session?.user.id,
            },
          },
        },
      ],
    },
  });

  if (!doc) return new Response("Not found", { status: 404 });

  const flashcard = await prisma.flashcard.findFirst({
    where: {
      id: flashcardId,
    },
  });

  if (!flashcard) return new Response("Not found", { status: 404 });

  const reqPrompt = `Your task is to generate feedback on the user's response without explicit headings. Please format the information as follows:
  1. Points the user got right, followed by a delimiter (||)
  2. Mistakes or inaccuracies made by the user, followed by the same delimiter
  3. Additional relevant information regarding the question and correct answer, followed by the delimiter.

  If user didn't get either right, or made no mistakes, don't add anything. Don't use any numbered bullet points.
  Ensure that the data is presented in plain text and adheres to this specific format consistently.
  
  User response: ${prompt}
  Question: ${flashcard.question}
  Correct answer: ${flashcard.answer}`;

  const response = await fireworks.completions.create({
    model: "accounts/fireworks/models/mixtral-8x7b-instruct",
    max_tokens: 2000,
    stream: true,
    prompt: reqPrompt,
  });

  const stream = OpenAIStream(response, {
    onCompletion: async (completion: string) => {
      const feedback = completion.split("||");
      const correctResponse = feedback[0];
      const incorrectResponse = feedback[1];
      const moreInfo = feedback[2];

      await prisma.flashcardAttempt.create({
        data: {
          userResponse: prompt,
          ...(correctResponse ? { correctResponse: correctResponse } : {}),
          ...(incorrectResponse
            ? { incorrectResponse: incorrectResponse }
            : {}),
          ...(moreInfo ? { moreInfo: moreInfo } : {}),
          flashcard: {
            connect: {
              id: flashcardId,
            },
          },
          user: {
            connect: {
              id: session.user.id,
            },
          },
        },
      });
    },
  });
  return new StreamingTextResponse(stream);
}

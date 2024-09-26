import { fireworks } from "@/lib/fireworks";
import { flashcardFeedbackSchema } from "@/schema/flashcard";
import { flashcardEvaluateRouteSchema } from "@/schema/routes";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { streamObject } from "ai";
import { getServerSession } from "next-auth";

export const maxDuration = 30;

export async function POST(req: Request, res: Response) {
  const reqBody = await req.json();
  let { flashcardId, docId, prompt } =
    flashcardEvaluateRouteSchema.parse(reqBody);

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

  if (!flashcard) return new Response("Flashcard not found", { status: 404 });

  const reqPrompt = `Your task is to provide feedback for the user's response. Please format the information as follows:
  - Mention the aspects the user accurately identified, highlight any mistakes or inaccuracies made by the user, ghen provide additional relevant information regarding the question and the correct answer.
  <USER RESPONSE>
  ${prompt} 
  </USER RESPONSE>
  <QUESTION>
  ${flashcard.question}
  </QUESTION>
  <CORRECT ANSWER>
  ${flashcard.answer}
  </CORRECT ANSWER>`;

  const result = await streamObject({
    // other models doesnt work for some reason
    model: fireworks("accounts/fireworks/models/firefunction-v1"),
    schema: flashcardFeedbackSchema,
    prompt: reqPrompt,
    maxTokens: 1000,
    onFinish: async ({ object: feedback }) => {
      if (!feedback) {
        throw new Error("Failed to generate feedback");
      }

      await prisma.flashcardAttempt.create({
        data: {
          userResponse: prompt,
          correctResponse: feedback.correctResponse,
          incorrectResponse: feedback.incorrectResponse,
          moreInfo: feedback.moreInfo,
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

  return result.toTextStreamResponse();
}

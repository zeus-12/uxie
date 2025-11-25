import { completionRouteSchema } from "@/schema/routes";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "edge";
export const maxDuration = 30;

export async function POST(req: Request) {
  // if (env.NODE_ENV === "development") {
  //   return generateDummyStream();
  // } else {
  const reqBody = await req.json();
  let { prompt } = completionRouteSchema.parse(reqBody);

  const result = streamText({
    model: google("gemini-2.0-flash"),
    messages: [
      {
        role: "system",
        content:
          "You are an AI writing assistant that continues existing text based on context from prior text. " +
          "Give more weight/priority to the later characters than the beginning ones. " +
          "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
          "Only return the text that you generate, not the prompt, only reply with the " +
          "You do not need to be cautious or formal around me, nor should you remind me you are an AI model. I am already aware of this. " +
          "I don’t need the fluff. Don’t bother with the “Sure, I can help with that” or similar statements." +
          "Don't put quotes around the text, just return the text.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    maxTokens: 400,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    maxSteps: 1,
  });

  return result.toDataStreamResponse();
  // }
}

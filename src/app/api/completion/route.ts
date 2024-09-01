import { env } from "@/env.mjs";
import fireworks from "@/lib/fireworks";
import { generateDummyStream } from "@/lib/utils";
import { OpenAIStream, StreamingTextResponse } from "ai";

export const runtime = "edge";

export async function POST(req: Request) {
  if (env.NODE_ENV === "development") {
    generateDummyStream();
  } else {
    const { prompt } = await req.json();

    const response = await fireworks.chat.completions.create({
      model: "accounts/fireworks/models/mixtral-8x7b-instruct",
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
      max_tokens: 400,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: true,
      n: 1,
    });

    const stream = OpenAIStream(response);

    return new StreamingTextResponse(stream);
  }
}

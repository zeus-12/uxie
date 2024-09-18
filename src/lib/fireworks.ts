import { env } from "@/env.mjs";
import { createOpenAI } from "@ai-sdk/openai";
import OpenAI from "openai";

export const fireworksOld = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: "https://api.fireworks.ai/inference/v1",
});

export const fireworks = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: "https://api.fireworks.ai/inference/v1",
});

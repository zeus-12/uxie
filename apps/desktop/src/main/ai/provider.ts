import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LlmSettings } from "../../ipc-contract";

// One global provider for every LLM feature. OpenAI-compatible covers Ollama
// (localhost:11434/v1), OpenAI, and most other endpoints.
export function llmModel(settings: LlmSettings) {
  const provider = createOpenAICompatible({
    name: "uxie",
    baseURL: settings.baseUrl,
    apiKey: settings.apiKey || undefined,
  });
  return provider(settings.model);
}

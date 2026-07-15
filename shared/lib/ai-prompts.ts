// The same writing-assistant instruction the web /api/completion route uses, so
// notes autocomplete behaves identically on web and desktop.
export const COMPLETION_INSTRUCTION =
  "You are an AI writing assistant that continues existing text based on context from prior text. " +
  "Give more weight/priority to the later characters than the beginning ones. " +
  "Limit your response to no more than 200 characters, but make sure to construct complete sentences. " +
  "Only return the text that you generate, not the prompt. " +
  "Don't put quotes around the text, just return the text.";

export function buildCompletionPrompt(prior: string): string {
  return `${COMPLETION_INSTRUCTION}\n\nContinue this text:\n${prior}`;
}

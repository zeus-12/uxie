import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type StepResult,
  type ToolSet,
} from "ai";

type StreamTextOptions<TOOLS extends ToolSet> = Parameters<
  typeof streamText<TOOLS>
>[0];

// The client only sees `finish` after saveTurn resolves, so a reply that is on
// screen is always in the database; any failure before that saves nothing.
export function chatTurnResponse<TOOLS extends ToolSet>({
  options,
  saveTurn,
}: {
  options: StreamTextOptions<TOOLS>;
  saveTurn: (steps: StepResult<TOOLS>[]) => Promise<void>;
}): Response {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText(options);
      for await (const chunk of result.toUIMessageStream({
        sendFinish: false,
      })) {
        writer.write(chunk);
        if (chunk.type === "error" || chunk.type === "abort") return;
      }
      await saveTurn(await result.steps);
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

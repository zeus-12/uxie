import { chatTurnResponse } from "@/lib/chat-turn";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { describe, expect, it, vi } from "vitest";

type StreamPart = Record<string, unknown>;

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 2, text: 2, reasoning: 0 },
};

const text = (delta: string): StreamPart[] => [
  { type: "stream-start", warnings: [] },
  { type: "text-start", id: "t" },
  { type: "text-delta", id: "t", delta },
  { type: "text-end", id: "t" },
];
const finish: StreamPart = {
  type: "finish",
  finishReason: { unified: "stop", raw: "stop" },
  usage,
};

function model(chunks: StreamPart[]) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({ chunks: chunks as never[] }),
    }),
  });
}

async function chunkTypes(response: Response): Promise<string[]> {
  const body = await response.text();
  return body
    .split("\n")
    .filter((line) => line.startsWith("data: {"))
    .map((line) => (JSON.parse(line.slice(6)) as { type: string }).type);
}

describe("chat turn persistence", () => {
  it("saves the turn before telling the client it finished", async () => {
    const events: string[] = [];
    const saveTurn = vi.fn(async (steps: { text: string }[]) => {
      events.push(`save:${steps.map((s) => s.text).join("")}`);
    });
    const types = await chunkTypes(
      chatTurnResponse({
        options: { model: model([...text("Hello"), finish]), prompt: "hi" },
        saveTurn,
      }),
    );

    expect(saveTurn).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["save:Hello"]);
    expect(types).toContain("text-delta");
    expect(types.at(-1)).toBe("finish");
  });

  it("saves nothing when the model fails mid-stream", async () => {
    const saveTurn = vi.fn(async () => undefined);
    const types = await chunkTypes(
      chatTurnResponse({
        options: {
          model: model([...text("Partial"), { type: "error", error: "boom" }]),
          prompt: "hi",
        },
        saveTurn,
      }),
    );

    expect(saveTurn).not.toHaveBeenCalled();
    expect(types).toContain("error");
    expect(types).not.toContain("finish");
  });

  it("reports an error and no finish when saving fails", async () => {
    const types = await chunkTypes(
      chatTurnResponse({
        options: { model: model([...text("Hello"), finish]), prompt: "hi" },
        saveTurn: async () => {
          throw new Error("db down");
        },
      }),
    );

    expect(types).toContain("error");
    expect(types).not.toContain("finish");
  });

  it("saves nothing when the request is aborted", async () => {
    const controller = new AbortController();
    const saveTurn = vi.fn(async () => undefined);
    const slow = new MockLanguageModelV4({
      doStream: async ({ abortSignal }) => ({
        stream: new ReadableStream({
          start(stream) {
            for (const chunk of text("Partial")) stream.enqueue(chunk as never);
            abortSignal?.addEventListener("abort", () =>
              stream.error(new DOMException("aborted", "AbortError")),
            );
            setTimeout(() => controller.abort(), 20);
          },
        }),
      }),
    });
    const types = await chunkTypes(
      chatTurnResponse({
        options: { model: slow, prompt: "hi", abortSignal: controller.signal },
        saveTurn,
      }),
    );

    expect(saveTurn).not.toHaveBeenCalled();
    expect(types).not.toContain("finish");
  });
});

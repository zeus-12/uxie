import { describe, expect, it } from "vitest";

import { toRetrievedChunks } from "@/lib/retrieved-chunks";

describe("toRetrievedChunks", () => {
  it("turns retrieved documents into JSON-safe tool results", () => {
    class RetrievedDocument {
      pageContent = "A relevant passage";
      metadata = {
        fileId: "document-id",
        blockId: "block-2",
        score: 0.91,
        nested: { page: 1 },
      };
    }

    const chunks = toRetrievedChunks([new RetrievedDocument()]);

    expect(chunks).toEqual([
      {
        pageContent: "A relevant passage",
        metadata: {
          fileId: "document-id",
          blockId: "block-2",
          score: 0.91,
        },
      },
    ]);
    expect(Object.getPrototypeOf(chunks[0])).toBe(Object.prototype);
  });
});

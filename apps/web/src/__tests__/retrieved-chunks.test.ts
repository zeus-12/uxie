import { describe, expect, it } from "vitest";

import {
  needsPageLookup,
  pageNumberFromMetadata,
  toRetrievedChunk,
} from "@/lib/retrieved-chunks";

describe("toRetrievedChunk", () => {
  it("keeps an article passage's block as its provenance", () => {
    expect(
      toRetrievedChunk(
        {
          pageContent: "A relevant passage",
          metadata: { fileId: "doc", kind: "article", blockId: "block-2" },
        },
        [],
      ),
    ).toEqual({
      kind: "article",
      pageContent: "A relevant passage",
      blockId: "block-2",
    });
  });

  it("reads the page of current and legacy PDF vectors", () => {
    expect(pageNumberFromMetadata({ pageNumber: 3 })).toBe(3);
    expect(pageNumberFromMetadata({ "loc.pageNumber": 4 })).toBe(4);
    expect(pageNumberFromMetadata({ loc: { pageNumber: 5 } })).toBe(5);
    expect(pageNumberFromMetadata({ pageNumber: 0 })).toBeNull();
  });

  it("recovers a legacy PDF page only when the passage is on exactly one page", () => {
    const document = {
      pageContent: "unique chunk",
      metadata: { fileId: "doc" },
    };
    expect(needsPageLookup(document)).toBe(true);
    expect(
      toRetrievedChunk(document, [
        { pageNumber: 1, text: "first page" },
        { pageNumber: 2, text: "has the unique chunk here" },
      ]),
    ).toEqual({ kind: "pdf", pageContent: "unique chunk", pageNumber: 2 });
    expect(
      toRetrievedChunk(document, [
        { pageNumber: 1, text: "unique chunk" },
        { pageNumber: 2, text: "unique chunk" },
      ]),
    ).toBeNull();
  });

  it("drops an article vector that lost its block id", () => {
    const document = { pageContent: "orphan", metadata: { kind: "article" } };
    expect(needsPageLookup(document)).toBe(false);
    expect(toRetrievedChunk(document, [])).toBeNull();
  });
});

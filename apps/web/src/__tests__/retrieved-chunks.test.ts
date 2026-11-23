import { describe, expect, it } from "vitest";

import {
  pageNumberFromMetadata,
  toGetInformationOutput,
} from "@/lib/retrieved-chunks";

describe("toGetInformationOutput", () => {
  it("cites PDF passages by page and article passages by block", () => {
    expect(
      toGetInformationOutput([
        { pageContent: "pdf text", metadata: { kind: "pdf", pageNumber: 3 } },
        {
          pageContent: "article text",
          metadata: { kind: "article", blockId: "block-2", snapshotId: "s" },
        },
      ]),
    ).toEqual({
      results: [
        { kind: "pdf", pageContent: "pdf text", pageNumber: 3 },
        { kind: "article", pageContent: "article text", blockId: "block-2" },
      ],
    });
  });

  it("reads the page only from vectors indexed with the viewer's text", () => {
    expect(pageNumberFromMetadata({ pageNumber: 3 })).toBe(3);
    expect(pageNumberFromMetadata({ "loc.pageNumber": 4 })).toBeNull();
    expect(pageNumberFromMetadata({ loc: { pageNumber: 5 } })).toBeNull();
    expect(pageNumberFromMetadata({ pageNumber: 0 })).toBeNull();
  });

  it("keeps passages without provenance for the model but never cites them", () => {
    expect(
      toGetInformationOutput([
        { pageContent: "legacy pdf text", metadata: { fileId: "doc" } },
        { pageContent: "orphan article text", metadata: { kind: "article" } },
        { pageContent: "pdf-parse text", metadata: { "loc.pageNumber": 2 } },
        {
          pageContent: "located",
          metadata: { kind: "pdf", pageNumber: 2 },
        },
      ]),
    ).toEqual({
      results: [{ kind: "pdf", pageContent: "located", pageNumber: 2 }],
      unlocated: ["legacy pdf text", "orphan article text", "pdf-parse text"],
    });
  });
});

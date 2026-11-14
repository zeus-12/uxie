import { describe, expect, it } from "vitest";
import {
  parseBookmarkLabel,
  parseCreateBookmarkInput,
} from "../src/main/bookmark-input";

describe("bookmark IPC input", () => {
  it("normalises an empty label to null", () => {
    expect(parseBookmarkLabel("   ")).toBeNull();
    expect(parseBookmarkLabel("  Chapter two  ")).toBe("Chapter two");
  });

  it("accepts a precise selection location", () => {
    expect(
      parseCreateBookmarkInput({
        documentId: "doc-1",
        pageNumber: 7,
        location: {
          version: 1,
          kind: "selection",
          exact: "Selected text",
          position: {
            boundingRect: {
              x1: 1,
              y1: 2,
              x2: 3,
              y2: 4,
              width: 2,
              height: 2,
              pageNumber: 7,
            },
            rects: [
              {
                x1: 1,
                y1: 2,
                x2: 3,
                y2: 4,
                width: 2,
                height: 2,
                pageNumber: 7,
              },
            ],
          },
        },
      }),
    ).toMatchObject({ documentId: "doc-1", pageNumber: 7 });
  });

  it("rejects invalid pages and malformed selection geometry", () => {
    expect(() =>
      parseCreateBookmarkInput({ documentId: "doc-1", pageNumber: 0 }),
    ).toThrow();
    expect(() =>
      parseCreateBookmarkInput({
        documentId: "doc-1",
        pageNumber: 1,
        location: {
          version: 1,
          kind: "selection",
          exact: "Text",
          position: { boundingRect: {}, rects: [] },
        },
      }),
    ).toThrow();
  });

  it("rejects selection geometry from another page", () => {
    const rect = {
      x1: 1,
      y1: 2,
      x2: 3,
      y2: 4,
      width: 2,
      height: 2,
      pageNumber: 3,
    };

    expect(() =>
      parseCreateBookmarkInput({
        documentId: "doc-1",
        pageNumber: 2,
        location: {
          version: 1,
          kind: "selection",
          exact: "Text",
          position: { boundingRect: rect, rects: [rect] },
        },
      }),
    ).toThrow("Selection geometry must be on the bookmark page");
  });
});

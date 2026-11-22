import {
  createArticleRange,
  getArticleTextSelection,
  paintArticleHighlights,
} from "@/components/article-reader/article-dom";
import type { ArticleDocumentData } from "@/types/reader";
import { beforeEach, describe, expect, it } from "vitest";

let root: HTMLDivElement;

beforeEach(() => {
  root = document.createElement("div");
  root.innerHTML = `
    <p data-uxie-block-id="block-1">Alpha <strong>bravo</strong> charlie delta.</p>
    <p data-uxie-block-id="block-2">Echo foxtrot golf.</p>
  `;
  document.body.replaceChildren(root);
});

describe("article text anchors", () => {
  it("maps a DOM selection to offsets in its semantic block", () => {
    const block = root.querySelector<HTMLElement>("[data-uxie-block-id]");
    expect(block).not.toBeNull();
    if (!block) return;

    const range = createArticleRange({ block, startOffset: 6, endOffset: 19 });
    expect(range?.toString()).toBe("bravo charlie");
    if (!range) return;

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(getArticleTextSelection(root)).toMatchObject({
      blockId: "block-1",
      startOffset: 6,
      endOffset: 19,
      exactText: "bravo charlie",
      prefix: "Alpha ",
      suffix: " delta.",
    });
  });

  it("accepts a paragraph selection that ends at the start of the next block", () => {
    const [first, second] = Array.from(
      root.querySelectorAll<HTMLElement>("[data-uxie-block-id]"),
    );
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;

    // What Chrome builds for a triple-click: the range leaves the paragraph and
    // ends at offset 0 of the block below it.
    const range = document.createRange();
    range.setStart(first.firstChild!, 0);
    range.setEnd(second, 0);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(getArticleTextSelection(root)).toMatchObject({
      blockId: "block-1",
      startOffset: 0,
      endOffset: 26,
      exactText: "Alpha bravo charlie delta.",
    });
  });

  it("rejects a selection that genuinely spans two blocks", () => {
    const [first, second] = Array.from(
      root.querySelectorAll<HTMLElement>("[data-uxie-block-id]"),
    );
    if (!first || !second) return;

    const range = document.createRange();
    range.setStart(first.firstChild!, 0);
    range.setEnd(second.firstChild!, 5);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(getArticleTextSelection(root)).toBeNull();
  });

  it("paints persisted highlights without changing article text", () => {
    const highlights = [
      {
        id: "highlight-1",
        selectedText: "bravo",
        anchor: {
          snapshotId: "snapshot-1",
          blockId: "block-1",
          startOffset: 6,
          endOffset: 11,
          exactText: "bravo",
          prefix: "Alpha ",
          suffix: " charlie delta.",
        },
      },
      {
        id: "highlight-2",
        selectedText: "delta",
        anchor: {
          snapshotId: "snapshot-1",
          blockId: "block-1",
          startOffset: 20,
          endOffset: 25,
          exactText: "delta",
          prefix: "Alpha bravo charlie ",
          suffix: ".",
        },
      },
    ] satisfies ArticleDocumentData["highlights"];

    const before = root.textContent;
    paintArticleHighlights(root, highlights);

    expect(root.textContent).toBe(before);
    expect(
      root.querySelectorAll("mark[data-article-highlight-id]"),
    ).toHaveLength(2);
    expect(
      root.querySelector('mark[data-article-highlight-id="highlight-1"]')
        ?.textContent,
    ).toBe("bravo");
  });
});

import type { ArticleDocumentData } from "@/types/reader";
import { PDF_ANNOTATION_HIGHLIGHT_COLOUR } from "@uxie/shared/lib/constants";

export type ArticleTextSelection = {
  blockId: string;
  startOffset: number;
  endOffset: number;
  exactText: string;
  prefix: string;
  suffix: string;
  rect: DOMRect;
};

const blockForNode = (node: Node | null) => {
  const element = node instanceof Element ? node : node?.parentElement ?? null;
  return element?.closest<HTMLElement>("[data-uxie-block-id]") ?? null;
};

const offsetWithin = ({
  block,
  node,
  offset,
}: {
  block: HTMLElement;
  node: Node;
  offset: number;
}) => {
  const range = document.createRange();
  range.selectNodeContents(block);
  range.setEnd(node, offset);
  return range.toString().length;
};

/**
 * True when the part of the range that reaches past `block` selects no text.
 * Chrome ends a triple-click at offset 0 of the following block, so the range
 * leaves the paragraph without taking anything from the next one.
 */
const selectsNothingPast = (range: Range, block: HTMLElement) => {
  const tail = document.createRange();
  tail.selectNodeContents(block);
  tail.collapse(false);
  try {
    tail.setEnd(range.endContainer, range.endOffset);
  } catch {
    return false;
  }
  return tail.toString().trim() === "";
};

export const getArticleTextSelection = (
  articleRoot: HTMLElement,
): ArticleTextSelection | null => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!articleRoot.contains(range.commonAncestorContainer)) return null;

  const startBlock = blockForNode(range.startContainer);
  if (!startBlock) return null;

  const endBlock = blockForNode(range.endContainer);
  const endsInStartBlock = endBlock === startBlock;
  if (!endsInStartBlock && !selectsNothingPast(range, startBlock)) return null;

  const blockId = startBlock.dataset.uxieBlockId;
  const blockText = startBlock.textContent ?? "";
  if (!blockId || !blockText) return null;

  const startOffset = offsetWithin({
    block: startBlock,
    node: range.startContainer,
    offset: range.startOffset,
  });
  const endOffset = endsInStartBlock
    ? offsetWithin({
        block: startBlock,
        node: range.endContainer,
        offset: range.endOffset,
      })
    : blockText.trimEnd().length;
  const exactText = blockText.slice(startOffset, endOffset);
  if (!exactText.trim()) return null;

  return {
    blockId,
    startOffset,
    endOffset,
    exactText,
    prefix: blockText.slice(Math.max(0, startOffset - 128), startOffset),
    suffix: blockText.slice(endOffset, endOffset + 128),
    rect: range.getBoundingClientRect(),
  };
};

export const createArticleRange = ({
  block,
  startOffset,
  endOffset,
}: {
  block: HTMLElement;
  startOffset: number;
  endOffset: number;
}) => {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let textOffset = 0;
  let startSet = false;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const length = node.textContent?.length ?? 0;
    const nextOffset = textOffset + length;

    if (!startSet && startOffset >= textOffset && startOffset <= nextOffset) {
      range.setStart(node, startOffset - textOffset);
      startSet = true;
    }
    if (startSet && endOffset >= textOffset && endOffset <= nextOffset) {
      range.setEnd(node, endOffset - textOffset);
      return range;
    }
    textOffset = nextOffset;
  }

  return null;
};

const clearPaintedHighlights = (root: HTMLElement) => {
  root
    .querySelectorAll<HTMLElement>("mark[data-article-highlight-id]")
    .forEach((mark) => mark.replaceWith(...Array.from(mark.childNodes)));
  root.normalize();
};

export const paintArticleHighlights = (
  root: HTMLElement,
  highlights: ArticleDocumentData["highlights"],
) => {
  clearPaintedHighlights(root);

  const ordered = [...highlights].sort((left, right) => {
    if (left.anchor.blockId === right.anchor.blockId) {
      return right.anchor.startOffset - left.anchor.startOffset;
    }
    return left.anchor.blockId.localeCompare(right.anchor.blockId);
  });

  for (const highlight of ordered) {
    if (highlight.anchor.snapshotId === "") continue;
    const block = root.querySelector<HTMLElement>(
      `[data-uxie-block-id="${highlight.anchor.blockId}"]`,
    );
    if (!block) continue;

    const range = createArticleRange({
      block,
      startOffset: highlight.anchor.startOffset,
      endOffset: highlight.anchor.endOffset,
    });
    if (!range || range.toString() !== highlight.anchor.exactText) continue;

    const mark = document.createElement("mark");
    mark.dataset.articleHighlightId = highlight.id;
    mark.className =
      "article-annotation rounded-[2px] text-inherit decoration-clone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-600 focus-visible:ring-offset-1";
    mark.style.backgroundColor = PDF_ANNOTATION_HIGHLIGHT_COLOUR;
    mark.tabIndex = 0;
    mark.setAttribute("role", "button");
    mark.setAttribute(
      "aria-label",
      `Highlighted text: ${highlight.selectedText}`,
    );
    mark.append(range.extractContents());
    range.insertNode(mark);
  }
};

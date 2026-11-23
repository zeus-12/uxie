type CaretPosition = { node: Node; offset: number };

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

export const caretAt = (x: number, y: number): CaretPosition | null => {
  const doc = document as CaretDocument;
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = doc.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
};

export const offsetWithin = (root: HTMLElement, caret: CaretPosition): number | null => {
  if (!root.contains(caret.node)) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n === caret.node) return total + caret.offset;
    total += (n as Text).length;
  }
  return null;
};

export const charRect = (root: HTMLElement, offset: number): DOMRect | null => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const length = (n as Text).length;
    if (remaining < length) {
      const range = document.createRange();
      range.setStart(n, remaining);
      range.setEnd(n, remaining + 1);
      const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
      return rect.height > 0 ? rect : null;
    }
    remaining -= length;
  }
  return null;
};

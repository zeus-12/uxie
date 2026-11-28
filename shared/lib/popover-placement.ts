export type Box = { top: number; right: number; bottom: number; left: number };

export type PopoverAnchor = {
  x: number;
  line: { top: number; bottom: number };
  block: { top: number; bottom: number };
};

export type PopoverSide = "top" | "bottom";

export type PopoverPlacement = {
  left: number;
  top: number;
  side: PopoverSide;
  arrowX: number;
};

export const POPOVER_GAP = 8;
export const POPOVER_ARROW_HEIGHT = 8;
export const POPOVER_EDGE = 8;
const ARROW_INSET = 19;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

export function placePopover(
  anchor: PopoverAnchor,
  size: { width: number; height: number },
  bounds: Box,
): PopoverPlacement {
  const offset = POPOVER_GAP + POPOVER_ARROW_HEIGHT;
  const belowTop = anchor.line.bottom + offset;
  const aboveTop = anchor.block.top - offset - size.height;
  const fitsBelow = belowTop + size.height <= bounds.bottom - POPOVER_EDGE;
  const fitsAbove = aboveTop >= bounds.top + POPOVER_EDGE;
  const side: PopoverSide = !fitsBelow && fitsAbove ? "top" : "bottom";
  const left = clamp(
    anchor.x - size.width / 2,
    bounds.left + POPOVER_EDGE,
    bounds.right - POPOVER_EDGE - size.width,
  );
  return {
    left,
    top: side === "bottom" ? belowTop : aboveTop,
    side,
    arrowX: clamp(anchor.x - left, ARROW_INSET, size.width - ARROW_INSET),
  };
}

export type AnchorSource = () => PopoverAnchor | null;

const usable = (rect: DOMRect) => rect.width > 0.5 && rect.height > 0.5;

function lineThrough(rects: DOMRect[], y: number) {
  const onLine = rects.filter((r) => y >= r.top && y <= r.bottom);
  if (onLine.length === 0) return null;
  return {
    top: Math.min(...onLine.map((r) => r.top)),
    bottom: Math.max(...onLine.map((r) => r.bottom)),
    left: Math.min(...onLine.map((r) => r.left)),
    right: Math.max(...onLine.map((r) => r.right)),
  };
}

function blockOf(rects: DOMRect[]) {
  return {
    top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

function textRects(range: Range): DOMRect[] {
  const root = range.commonAncestorContainer;
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      range.intersectsNode(node) && (node as Text).length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  const nodes: Text[] =
    root.nodeType === Node.TEXT_NODE ? [root as Text] : [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  const piece = doc.createRange();
  return nodes.flatMap((node) => {
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end <= start || !node.data.slice(start, end).trim()) return [];
    piece.setStart(node, start);
    piece.setEnd(node, end);
    return [...piece.getClientRects()].filter(usable);
  });
}

export function selectionAnchor(selection: Selection | null): AnchorSource | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
  if (!anchorNode || !focusNode) return null;
  const range = selection.getRangeAt(0).cloneRange();
  const focus = range.cloneRange();
  focus.setStart(focusNode, focusOffset);
  focus.collapse(true);
  const backward =
    anchorNode.compareDocumentPosition(focusNode) & Node.DOCUMENT_POSITION_PRECEDING ||
    (anchorNode === focusNode && focusOffset < anchorOffset);

  return () => {
    const rects = textRects(range);
    if (rects.length === 0) return null;
    const caret = focus.getBoundingClientRect();
    const line = caret.height > 0 ? lineThrough(rects, caret.top + caret.height / 2) : null;
    if (line) {
      return { x: clamp(caret.left, line.left, line.right), line, block: blockOf(rects) };
    }
    const edge = backward ? rects[0]! : rects[rects.length - 1]!;
    const fallback = lineThrough(rects, edge.top + edge.height / 2)!;
    return {
      x: backward ? edge.left : edge.right,
      line: fallback,
      block: blockOf(rects),
    };
  };
}

export function pointerAnchor(
  getRects: () => DOMRect[],
  clientX: number,
  clientY: number,
): AnchorSource | null {
  const initial = getRects().filter(usable);
  if (initial.length === 0) return null;
  const nearestToPointer = (r: DOMRect) =>
    clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0;
  const index = initial.reduce(
    (best, r, i) => (nearestToPointer(r) < nearestToPointer(initial[best]!) ? i : best),
    0,
  );
  const hit = initial[index]!;
  const dx = clamp(clientX, hit.left, hit.right) - hit.left;

  return () => {
    const rects = getRects().filter(usable);
    const at = rects[index] ?? rects[rects.length - 1];
    if (!at) return null;
    const line = lineThrough(rects, at.top + at.height / 2)!;
    return { x: clamp(at.left + dx, line.left, line.right), line, block: blockOf(rects) };
  };
}

export function rectAnchor(getRect: () => DOMRect | null): AnchorSource {
  return () => {
    const rect = getRect();
    if (!rect || !usable(rect)) return null;
    return {
      x: rect.left + rect.width / 2,
      line: { top: rect.top, bottom: rect.bottom },
      block: { top: rect.top, bottom: rect.bottom },
    };
  };
}

export function aboveBottomOverlays(bounds: Box, overlays: DOMRect[]): Box {
  const middle = (bounds.top + bounds.bottom) / 2;
  const bottom = overlays
    .filter((o) => o.width > 0 && o.top > middle && o.top < bounds.bottom)
    .reduce((edge, o) => Math.min(edge, o.top), bounds.bottom);
  return { ...bounds, bottom };
}

export function scrollBounds(element: Element): Box {
  const view = element.ownerDocument.defaultView;
  let bounds: Box = {
    top: 0,
    left: 0,
    right: view?.innerWidth ?? Number.POSITIVE_INFINITY,
    bottom: view?.innerHeight ?? Number.POSITIVE_INFINITY,
  };
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(node);
    if (![overflowX, overflowY].some((o) => o === "auto" || o === "scroll" || o === "hidden")) {
      continue;
    }
    const r = node.getBoundingClientRect();
    const top = r.top + node.clientTop;
    const left = r.left + node.clientLeft;
    bounds = {
      top: Math.max(bounds.top, top),
      left: Math.max(bounds.left, left),
      bottom: Math.min(bounds.bottom, top + node.clientHeight),
      right: Math.min(bounds.right, left + node.clientWidth),
    };
  }
  return bounds;
}

import { useCallback, useEffect, useRef, useState } from "react";
import {
  pointerAnchor,
  selectionAnchor,
  type AnchorSource,
} from "../lib/popover-placement";

export type HighlightTipState = { id: string; anchor: AnchorSource; pinned: boolean };
export type SelectionTipState<T> = { value: T; anchor: AnchorSource };

// Wider than the 16px gap plus pointer between a line and its bar, so moving from the
// highlight into the bar never counts as moving away.
const SAFE_X = 60;
const SAFE_Y = 30;

export const highlightElementAt = (target: EventTarget | null, root: HTMLElement) => {
  const element = (target as Element | null)?.closest?.<HTMLElement>("[data-highlight-id]");
  return element && root.contains(element) ? element : null;
};

const usableRects = (element: Element): DOMRect[] => {
  const own = [...element.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
  return own.length > 0 ? own : [...element.children].flatMap(usableRects);
};

export const highlightRects = (root: HTMLElement, id: string) =>
  [...root.querySelectorAll(`[data-highlight-id="${CSS.escape(id)}"]`)].flatMap(usableRects);

const within = (target: EventTarget | null, element: HTMLElement | null) =>
  Boolean(element && target instanceof Node && element.contains(target));

export function useHighlightTip(root: HTMLElement | null, { suspended }: { suspended: boolean }) {
  const [tip, setTip] = useState<HighlightTipState | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef(tip);
  tipRef.current = tip;
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;
  const close = useCallback(() => setTip(null), []);

  useEffect(() => {
    if (!root) return;
    const anchorAt = (id: string, x: number, y: number) =>
      pointerAnchor(() => highlightRects(root, id), x, y);
    const open = (element: HTMLElement, x: number, y: number, pinned: boolean) => {
      const id = element.dataset.highlightId!;
      const anchor = anchorAt(id, x, y);
      if (anchor) setTip({ id, anchor, pinned });
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons || suspendedRef.current) return;
      if (tipRef.current?.pinned || !window.getSelection()?.isCollapsed) return;
      const element = highlightElementAt(e.target, root);
      if (element && tipRef.current?.id !== element.dataset.highlightId) {
        open(element, e.clientX, e.clientY, false);
      }
    };
    const onMove = (e: PointerEvent) => {
      const current = tipRef.current;
      if (e.pointerType !== "mouse" || !current || current.pinned) return;
      if (highlightElementAt(e.target, root)?.dataset.highlightId === current.id) return;
      const box = popoverRef.current?.getBoundingClientRect();
      const near =
        box &&
        e.clientX > box.left - SAFE_X &&
        e.clientX < box.right + SAFE_X &&
        e.clientY > box.top - SAFE_Y &&
        e.clientY < box.bottom + SAFE_Y;
      if (!near) setTip(null);
    };
    const onClick = (e: MouseEvent) => {
      const element = highlightElementAt(e.target, root);
      if (!element || !window.getSelection()?.isCollapsed) return;
      open(element, e.clientX, e.clientY, true);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTip(null);
        return;
      }
      if (e.key !== "Enter") return;
      const element = highlightElementAt(e.target, root);
      const first = element && usableRects(element)[0];
      if (first) open(element, first.left + first.width / 2, first.top + first.height / 2, true);
    };
    const onDown = (e: PointerEvent) => {
      if (within(e.target, popoverRef.current)) return;
      const id = highlightElementAt(e.target, root)?.dataset.highlightId;
      if (id && id === tipRef.current?.id) return;
      setTip(null);
    };

    root.addEventListener("pointerover", onOver);
    root.addEventListener("click", onClick);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("click", onClick);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKeyDown);
      setTip(null);
    };
  }, [root]);

  useEffect(() => {
    if (suspended) setTip(null);
  }, [suspended]);

  return { tip, popoverRef, close };
}

// `describe` runs on every settled selection change; it may read layout but must not
// change the DOM, or the live selection is dropped.
export function useSelectionTip<T>(
  root: HTMLElement | null,
  describe: (selection: Selection, range: Range) => T | null,
) {
  const [tip, setTip] = useState<SelectionTipState<T> | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const describeRef = useRef(describe);
  describeRef.current = describe;
  const close = useCallback(() => setTip(null), []);
  const show = useCallback((value: T, anchor: AnchorSource) => setTip({ value, anchor }), []);

  useEffect(() => {
    if (!root) return;
    let dragging = false;

    const update = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      const value = describeRef.current(selection, range);
      const anchor = selectionAnchor(selection);
      if (value !== null && anchor) setTip({ value, anchor });
    };
    const onDown = (e: PointerEvent) => {
      if (within(e.target, popoverRef.current)) return;
      setTip(null);
      dragging = within(e.target, root);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      update();
    };
    const onChange = () => {
      if (!dragging) update();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTip(null);
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("selectionchange", onChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("selectionchange", onChange);
      document.removeEventListener("keydown", onKeyDown);
      setTip(null);
    };
  }, [root]);

  return { tip, popoverRef, close, show };
}

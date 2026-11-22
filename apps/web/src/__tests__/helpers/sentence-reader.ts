import { useSentenceReader } from "@uxie/shared/hooks/use-sentence-reader";
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

export type ReaderApi = ReturnType<typeof useSentenceReader>;

// The test DOMs have no layout, so every Range gets one fake rect and the assertions
// only use data-hl-text. Visual alignment is checked against the live app.
const FAKE_RECT = {
  left: 0,
  top: 0,
  right: 8,
  bottom: 8,
  width: 8,
  height: 8,
  x: 0,
  y: 0,
  toJSON() {},
};
export function fakeRangeClientRects() {
  Range.prototype.getClientRects = () =>
    ({
      length: 1,
      0: FAKE_RECT,
      item: () => FAKE_RECT,
    }) as unknown as DOMRectList;
}

export function mountReader(pageCount = 1): ReaderApi {
  const ref: { current: ReaderApi | null } = { current: null };
  const Host = () => {
    ref.current = useSentenceReader({ pageCount });
    return null;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  flushSync(() => createRoot(container).render(React.createElement(Host)));
  if (!ref.current) throw new Error("reader did not mount");
  return ref.current;
}

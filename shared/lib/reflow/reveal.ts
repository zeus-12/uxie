export const REFLOW_REVEAL_EVENT = "reflow:reveal-page";
export const REFLOW_LAYOUT_EVENT = "reflow:layout";

export const requestReflowPage = (pageNumber: number) =>
  document.dispatchEvent(new CustomEvent(REFLOW_REVEAL_EVENT, { detail: { pageNumber } }));

export const announceReflowLayout = () => document.dispatchEvent(new CustomEvent(REFLOW_LAYOUT_EVENT));

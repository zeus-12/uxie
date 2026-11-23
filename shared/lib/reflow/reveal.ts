export const REFLOW_REVEAL_EVENT = "reflow:reveal-page";

export const requestReflowPage = (pageNumber: number) =>
  document.dispatchEvent(new CustomEvent(REFLOW_REVEAL_EVENT, { detail: { pageNumber } }));

import {
  clearCitationHighlights,
  paintCitationHighlight,
} from "./pdf-citation-highlight";

export const CITATION_HIGHLIGHT_DURATION_MS = 6000;
const TEXT_LAYER_WAIT_MS = 5000;

type CitationViewer = {
  scrollPageIntoView: (args: { pageNumber: number }) => void;
};

type CitationNavigatorOptions = {
  getViewer: () => CitationViewer | null;
  onError: (message: string) => void;
  subscribeTextLayerRendered: (
    listener: (pageNumber: number) => void,
  ) => () => void;
  prefersReducedMotion?: () => boolean;
};

export type CitationNavigator = {
  showSource: (pageNumber: number, text: string) => void;
  dispose: () => void;
};

export function createCitationNavigator({
  getViewer,
  onError,
  subscribeTextLayerRendered,
  prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
}: CitationNavigatorOptions): CitationNavigator {
  let removalTimer: ReturnType<typeof setTimeout> | null = null;
  let waitCleanup: (() => void) | null = null;

  const stopWaiting = () => {
    waitCleanup?.();
    waitCleanup = null;
  };
  const stopRemovalTimer = () => {
    if (!removalTimer) return;
    clearTimeout(removalTimer);
    removalTimer = null;
  };
  const paint = (pageNumber: number, text: string) => {
    const highlight = paintCitationHighlight(pageNumber, text);
    if (!highlight) return false;

    stopRemovalTimer();
    highlight.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
    removalTimer = setTimeout(() => {
      clearCitationHighlights();
      removalTimer = null;
    }, CITATION_HIGHLIGHT_DURATION_MS);
    return true;
  };

  const showSource = (pageNumber: number, text: string) => {
    stopWaiting();
    stopRemovalTimer();
    clearCitationHighlights();

    const viewer = getViewer();
    if (!viewer) {
      onError("The document is still loading");
      return;
    }
    viewer.scrollPageIntoView({ pageNumber });
    if (paint(pageNumber, text)) return;

    const page = document.querySelector(
      `.page[data-page-number="${pageNumber}"]`,
    );
    if (page?.querySelector("span[role='presentation']")) {
      onError("Couldn't locate the exact source passage on this page");
      return;
    }

    const onTextLayerRendered = (renderedPage: number) => {
      if (renderedPage !== pageNumber) return;
      stopWaiting();
      if (!paint(pageNumber, text)) {
        onError("Couldn't locate the exact source passage on this page");
      }
    };
    const unsubscribe = subscribeTextLayerRendered(onTextLayerRendered);
    const waitTimer = setTimeout(() => {
      stopWaiting();
      onError("The source page took too long to load");
    }, TEXT_LAYER_WAIT_MS);
    waitCleanup = () => {
      unsubscribe();
      clearTimeout(waitTimer);
    };
  };

  return {
    showSource,
    dispose: () => {
      stopWaiting();
      stopRemovalTimer();
      clearCitationHighlights();
    },
  };
}

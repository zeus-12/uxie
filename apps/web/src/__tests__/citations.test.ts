import { CitationSources } from "@uxie/shared/components/chat/chat-panel";
import {
  getInformationOutputSchema,
  retrievedChunksFromParts,
} from "@uxie/shared/lib/chat";
import { chatPartsToRows } from "@uxie/shared/lib/chat-rows";
import {
  CITATION_HIGHLIGHT_DURATION_MS,
  createCitationNavigator,
} from "@uxie/shared/lib/citation-navigation";
import {
  clearCitationHighlights,
  paintCitationHighlight,
} from "@uxie/shared/lib/pdf-citation-highlight";
import {
  findExactPdfTextRange,
  normalizePdfText,
} from "@uxie/shared/lib/pdf-text-layer";
import {
  useCitationHighlightStore,
  useMobileSidebarStore,
} from "@uxie/shared/lib/store";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const RECT = {
  left: 10,
  top: 20,
  right: 110,
  bottom: 40,
  width: 100,
  height: 20,
  x: 10,
  y: 20,
  toJSON() {},
};

Range.prototype.getClientRects = () =>
  ({ length: 1, 0: RECT, item: () => RECT }) as unknown as DOMRectList;
Element.prototype.scrollIntoView = vi.fn();

function buildPage(pageNumber: number, spans: string[]): Element {
  const page = document.createElement("div");
  page.className = "page";
  page.setAttribute("data-page-number", String(pageNumber));
  page.getBoundingClientRect = () => RECT as DOMRect;
  for (const text of spans) {
    const span = document.createElement("span");
    span.setAttribute("role", "presentation");
    span.textContent = text;
    page.appendChild(span);
  }
  document.body.appendChild(page);
  return page;
}

afterEach(() => {
  vi.useRealTimers();
  clearCitationHighlights();
  useCitationHighlightStore.getState().setHighlightSource(null);
  useMobileSidebarStore.getState().setDrawerOpen(false);
  document.body.innerHTML = "";
});

describe("citation source boundaries", () => {
  const source = {
    kind: "pdf" as const,
    pageContent: "The exact retrieved passage.",
    pageNumber: 4,
  };
  const articleSource = {
    kind: "article" as const,
    pageContent: "A passage from the article.",
    blockId: "block-7",
  };

  it("keeps PDF and article sources apart, even with identical text", () => {
    const sameText = { ...articleSource, pageContent: source.pageContent };
    expect(
      retrievedChunksFromParts([
        {
          type: "tool-result",
          result: { results: [source, sameText, articleSource] },
        },
      ]),
    ).toEqual([source, sameText, articleSource]);
  });

  it("parses live and persisted tool outputs and deduplicates them", () => {
    expect(
      retrievedChunksFromParts([
        {
          type: "tool-getInformation",
          state: "output-available",
          output: { results: [source] },
        },
        { type: "tool-result", result: { results: [source] } },
      ]),
    ).toEqual([source]);
  });

  it("attaches live and stored sources to the assistant answer", () => {
    const live = chatPartsToRows("assistant", [
      {
        type: "tool-getInformation",
        state: "output-available",
        output: { results: [source] },
      },
      { type: "text", text: "Grounded answer" },
    ]);
    const stored = chatPartsToRows("assistant", [
      { type: "tool-getInformation", args: { question: "why" } },
      { type: "tool-result", result: { results: [source] } },
      { type: "text", text: "Grounded answer" },
    ]);

    expect(live.at(-1)).toMatchObject({ kind: "message", sources: [source] });
    expect(stored.at(-1)).toMatchObject({ kind: "message", sources: [source] });
  });

  it("rejects chunks without provenance instead of constructing a false citation", () => {
    for (const chunk of [
      { pageContent: "Legacy text with no page" },
      { pageContent: "Legacy main shape", metadata: { blockId: "b1" } },
      { kind: "pdf", pageContent: "No page number" },
      { kind: "article", pageContent: "No block id" },
    ]) {
      expect(
        getInformationOutputSchema.safeParse({ results: [chunk] }).success,
      ).toBe(false);
    }
    expect(
      retrievedChunksFromParts([
        {
          type: "tool-result",
          result: { results: [{ pageContent: "Legacy text with no page" }] },
        },
      ]),
    ).toEqual([]);
  });
});

describe("exact PDF source matching", () => {
  it("connects the rendered source button to page navigation and exact highlighting", () => {
    vi.useFakeTimers();
    const source = {
      kind: "pdf" as const,
      pageContent: "The entire exact source passage.",
      pageNumber: 5,
    };
    const scrollPageIntoView = vi.fn();
    const navigator = createCitationNavigator({
      getViewer: () => ({ scrollPageIntoView }),
      onError: vi.fn(),
      subscribeTextLayerRendered: () => () => {},
      prefersReducedMotion: () => true,
    });
    buildPage(5, [source.pageContent]);
    useCitationHighlightStore.getState().setHighlightSource((chunk) => {
      if (chunk.kind === "pdf") {
        navigator.showSource(chunk.pageNumber, chunk.pageContent);
      }
    });
    useMobileSidebarStore.getState().setDrawerOpen(true);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() =>
      root.render(createElement(CitationSources, { sources: [source] })),
    );

    const button = container.querySelector("button");
    expect(button?.textContent).toContain("Page 5");
    expect(button?.textContent).toContain(source.pageContent);
    button?.click();

    expect(scrollPageIntoView).toHaveBeenCalledWith({ pageNumber: 5 });
    expect(document.querySelector(".citation-hl-source")).not.toBeNull();
    expect(useMobileSidebarStore.getState().isDrawerOpen).toBe(false);

    flushSync(() => root.unmount());
    navigator.dispose();
  });

  it("matches one source across PDF text spans after whitespace normalization", () => {
    const page = buildPage(3, ["Alpha", "beta", "gamma."]);
    const range = findExactPdfTextRange(page, "Alpha\n  beta gamma.");
    expect(range).not.toBeNull();

    const highlight = paintCitationHighlight(3, "Alpha beta\n gamma.");
    expect(highlight).not.toBeNull();
    expect(document.querySelectorAll(".citation-hl-source")).toHaveLength(1);
    expect(document.querySelectorAll(".citation-hl-source path")).toHaveLength(
      1,
    );
  });

  it("fails closed when the complete normalized passage is not on the page", () => {
    const page = buildPage(8, ["Similar words", "but not the cited sentence."]);
    expect(
      findExactPdfTextRange(page, "Similar words from another sentence."),
    ).toBeNull();
    expect(
      paintCitationHighlight(8, "Similar words from another sentence."),
    ).toBeNull();
    expect(document.querySelector(".citation-hl-source")).toBeNull();
  });

  it("replaces the previous temporary source overlay", () => {
    buildPage(1, ["First source."]);
    buildPage(2, ["Second source."]);
    expect(paintCitationHighlight(1, "First source.")).not.toBeNull();
    expect(paintCitationHighlight(2, "Second source.")).not.toBeNull();
    expect(document.querySelectorAll(".citation-hl-source")).toHaveLength(1);
  });

  it("waits for a virtualized text layer and removes the overlay after six seconds", () => {
    vi.useFakeTimers();
    const scrollPageIntoView = vi.fn();
    const onError = vi.fn();
    let textLayerRendered = (_pageNumber: number) => {};
    const navigator = createCitationNavigator({
      getViewer: () => ({ scrollPageIntoView }),
      onError,
      subscribeTextLayerRendered: (listener) => {
        textLayerRendered = listener;
        return () => {
          textLayerRendered = () => {};
        };
      },
      prefersReducedMotion: () => true,
    });

    navigator.showSource(6, "A delayed source.");
    expect(scrollPageIntoView).toHaveBeenCalledWith({ pageNumber: 6 });
    expect(document.querySelector(".citation-hl-source")).toBeNull();

    buildPage(6, ["A delayed source."]);
    textLayerRendered(6);
    expect(onError).not.toHaveBeenCalled();
    expect(document.querySelector(".citation-hl-source")).not.toBeNull();

    vi.advanceTimersByTime(CITATION_HIGHLIGHT_DURATION_MS - 1);
    expect(document.querySelector(".citation-hl-source")).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.querySelector(".citation-hl-source")).toBeNull();
    navigator.dispose();
  });
});

describe("pdf text normalization", () => {
  it("collapses whitespace runs", () => {
    expect(normalizePdfText(" a\n b  ")).toBe("a b");
  });
});

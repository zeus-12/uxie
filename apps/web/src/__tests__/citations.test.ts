import { CitedMarkdown } from "@uxie/shared/components/chat/chat-panel";
import { TooltipProvider } from "@uxie/shared/components/ui/tooltip";
import {
  citablePassagesFromParts,
  createCitationNumberer,
  getInformationOutputSchema,
  withCitablePassages,
  type RetrievedChunk,
} from "@uxie/shared/lib/chat";
import { chatPartsToRows } from "@uxie/shared/lib/chat-rows";
import { withoutPartialCitation } from "@uxie/shared/lib/citation-markdown";
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
import ReactMarkdown from "react-markdown";
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

describe("numbered citations", () => {
  const page4 = {
    kind: "pdf" as const,
    pageContent: "The exact retrieved passage.",
    pageNumber: 4,
  };
  const page9 = {
    kind: "pdf" as const,
    pageContent: "Another passage.",
    pageNumber: 9,
  };
  const article = {
    kind: "article" as const,
    pageContent: "A passage from the article.",
    blockId: "block-7",
  };

  it("numbers new passages after every ref already in the conversation", () => {
    const history = [
      [
        {
          type: "tool-result",
          result: {
            results: [
              { ...page4, ref: 1 },
              { ...page9, ref: 2 },
            ],
          },
        },
      ],
      [{ type: "text", text: "no tools here" }],
    ];
    const numberPassages = createCitationNumberer(history);
    expect(numberPassages([article])).toEqual([{ ...article, ref: 3 }]);
    expect(numberPassages([page4])).toEqual([{ ...page4, ref: 4 }]);
  });

  it("reads live and stored outputs and lets a later passage reuse a ref", () => {
    const first = withCitablePassages(new Map(), [
      {
        type: "tool-getInformation",
        state: "output-available",
        output: { results: [{ ...page4, ref: 1 }] },
      },
    ]);
    const second = withCitablePassages(first, [
      { type: "tool-result", result: { results: [{ ...article, ref: 1 }] } },
    ]);
    expect(first.get(1)).toEqual(page4);
    expect(second.get(1)).toEqual(article);
  });

  it("keeps passages without a ref or provenance out of the citable set", () => {
    expect(
      citablePassagesFromParts([
        { type: "tool-result", result: { results: [page4] } },
      ]),
    ).toEqual([]);
    for (const chunk of [
      { pageContent: "Legacy text with no page" },
      { kind: "pdf", pageContent: "No page number", ref: 1 },
      { kind: "article", pageContent: "No block id", ref: 1 },
    ]) {
      expect(
        getInformationOutputSchema.safeParse({ results: [chunk] }).success,
      ).toBe(false);
    }
  });

  it("gives the citations index only to assistant text", () => {
    const citations = new Map([[1, page4]]);
    expect(
      chatPartsToRows(
        "assistant",
        [{ type: "text", text: "A [1]" }],
        citations,
      ),
    ).toEqual([
      { kind: "message", role: "assistant", content: "A [1]", citations },
    ]);
    expect(
      chatPartsToRows("user", [{ type: "text", text: "Q [1]" }], citations),
    ).toEqual([{ kind: "message", role: "user", content: "Q [1]" }]);
  });
});

function renderCited(content: string, citations: Map<number, RetrievedChunk>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      createElement(
        TooltipProvider,
        null,
        createElement(CitedMarkdown, {
          content,
          citations,
          renderMarkdown: (text, options) =>
            createElement(ReactMarkdown, {
              children: text,
              remarkPlugins: options?.remarkPlugins,
              components: options?.components,
            }),
        }),
      ),
    ),
  );
  return { container, root };
}

describe("cited answer rendering", () => {
  const page4 = {
    kind: "pdf" as const,
    pageContent: "Passage on page four.",
    pageNumber: 4,
  };
  const page9 = {
    kind: "pdf" as const,
    pageContent: "Passage on page nine.",
    pageNumber: 9,
  };
  const citations = new Map<number, RetrievedChunk>([
    [7, page4],
    [12, page9],
  ]);

  it("renders ref tokens as bracketed groups labelled by ref", () => {
    const { container, root } = renderCited(
      "Traces are linear [ref:12]. They nest [ref:7][ref:12], see [ref:7, 40] and [ref:12, ref:7].",
      citations,
    );
    expect(container.querySelector("p")?.textContent).toBe(
      "Traces are linear [12]. They nest [7, 12], see [7] and [12, 7].",
    );
    expect(
      [...container.querySelectorAll("button")].map((button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual([
      "Source 12, Page 9",
      "Source 7, Page 4",
      "Source 12, Page 9",
      "Source 7, Page 4",
      "Source 12, Page 9",
      "Source 7, Page 4",
    ]);
    flushSync(() => root.unmount());
  });

  it("drops ref tokens that name no retrieved passage", () => {
    const { container, root } = renderCited(
      "Invented [ref:40]. Mixed [ref:40, 7].",
      citations,
    );
    expect(container.textContent).toBe("Invented. Mixed [7].");
    flushSync(() => root.unmount());
  });

  it("leaves the document's own bracketed numbers, code and links as written", () => {
    const { container, root } = renderCited(
      "The paper's own [7] and [12], x[0], `[ref:7]` and [see [ref:7]](https://example.com).",
      citations,
    );
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.textContent).toBe(
      "The paper's own [7] and [12], x[0], [ref:7] and see [ref:7].",
    );
    flushSync(() => root.unmount());
  });

  it("renders no refs when the answer cites nothing", () => {
    const { container, root } = renderCited("Not in the document.", citations);
    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent).toBe("Not in the document.");
    flushSync(() => root.unmount());
  });

  it("opens the cited passage from an inline ref", () => {
    const highlightSource = vi.fn();
    useCitationHighlightStore.getState().setHighlightSource(highlightSource);
    useMobileSidebarStore.getState().setDrawerOpen(true);
    const { container, root } = renderCited("Claim [ref:12].", citations);
    container.querySelector("button")!.click();
    expect(highlightSource).toHaveBeenCalledWith(page9);
    expect(useMobileSidebarStore.getState().isDrawerOpen).toBe(false);
    flushSync(() => root.unmount());
  });
});

describe("streaming citation tokens", () => {
  it("hides a citation token until its closing bracket arrives", () => {
    for (const partial of [
      "[",
      "[r",
      "[ref",
      "[ref:",
      "[ref:3",
      "[ref:3, ",
      "[ref:3, ref:4",
    ]) {
      expect(withoutPartialCitation(`Compiled ${partial}`)).toBe("Compiled ");
    }
    expect(withoutPartialCitation("Compiled [ref:3].")).toBe(
      "Compiled [ref:3].",
    );
    expect(withoutPartialCitation("See [Figure 2")).toBe("See [Figure 2");
  });
});

describe("exact PDF source matching", () => {
  it("connects an inline ref to page navigation and exact highlighting", () => {
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

    const { container, root } = renderCited(
      "Grounded claim [ref:3].",
      new Map([[3, source]]),
    );
    const button = container.querySelector("p button") as HTMLButtonElement;
    expect(button.getAttribute("aria-label")).toBe("Source 3, Page 5");
    button.click();

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

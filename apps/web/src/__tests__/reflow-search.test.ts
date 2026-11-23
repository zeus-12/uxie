// @vitest-environment jsdom
import { convertMatches } from "@uxie/shared/lib/reflow/anchors";
import { createReflowSource } from "@uxie/shared/lib/reflow/source";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDocument, renderTextLayer } from "pdfjs-dist/legacy/build/pdf";
import { EventBus, PDFFindController } from "pdfjs-dist/legacy/web/pdf_viewer";
import { TextHighlighter } from "pdfjs-dist/lib/web/text_highlighter";
import { describe, expect, it } from "vitest";

const searchPage = async (file: string, pageNumber: number, query: string) => {
  const data = new Uint8Array(readFileSync(resolve(__dirname, file)));
  const pdfDocument = await getDocument({ data, verbosity: 0, fontExtraProperties: true }).promise;
  const pdfPage = await pdfDocument.getPage(pageNumber);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const textDivs: HTMLElement[] = [];
  const textContentItemsStr: string[] = [];
  await renderTextLayer({
    textContent: await pdfPage.getTextContent(),
    container,
    viewport: pdfPage.getViewport({ scale: 1 }),
    textDivs,
    textContentItemsStr,
  }).promise;

  const eventBus = new EventBus();
  const findController = new PDFFindController({
    eventBus,
    linkService: { page: pageNumber, pagesCount: pdfDocument.numPages } as never,
  });
  findController.setDocument(pdfDocument);
  const highlighter = new TextHighlighter({ findController, eventBus, pageIndex: pageNumber - 1 });
  highlighter.setTextMapping(textDivs, textContentItemsStr);
  highlighter.enable();
  const searched = new Promise<void>((done) =>
    eventBus.on("updatetextlayermatches", ({ pageIndex }: { pageIndex: number }) => {
      if (pageIndex === pageNumber - 1 && findController.pageMatches?.[pageIndex]) done();
    }),
  );
  eventBus.dispatch("find", {
    source: null,
    type: "again",
    query,
    phraseSearch: true,
    caseSensitive: false,
    entireWord: false,
    highlightAll: true,
    findPrevious: false,
    matchDiacritics: false,
  });
  await searched;
  const index = pageNumber - 1;
  return {
    textContentItemsStr,
    pageMatches: findController.pageMatches![index] as number[],
    pageMatchesLength: findController.pageMatchesLength![index] as number[],
    pdfJsMatches: (highlighter as unknown as { matches: unknown[] }).matches,
    reflowItems: (await createReflowSource(pdfDocument).pageInput(pageNumber)).items,
  };
};

describe("reflow search projection", () => {
  it.each([
    ["../../public/demo.pdf", 1, "reading"],
    ["fixtures/reflow/tracemonkey-two-column.pdf", 1, "trace"],
    ["fixtures/reflow/scotus-opinion.pdf", 3, "first amendment"],
  ])("maps %s page %i matches for %s onto the same item offsets as pdf.js", async (file, page, query) => {
    const r = await searchPage(file, page, query);
    expect(r.pageMatches.length).toBeGreaterThan(0);
    const ours = convertMatches(r.textContentItemsStr, r.pageMatches, r.pageMatchesLength).map((m) => ({
      begin: { divIdx: m.begin.itemIndex, offset: m.begin.offset },
      end: { divIdx: m.end.itemIndex, offset: m.end.offset },
    }));
    expect(ours).toEqual(r.pdfJsMatches);
    for (const item of r.reflowItems) expect(item.str).toBe(r.textContentItemsStr[item.index]);
  });
});

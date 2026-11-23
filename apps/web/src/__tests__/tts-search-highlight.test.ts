// @vitest-environment jsdom
// jsdom draws with node-canvas, which pdf.js's renderTextLayer needs to measure glyphs.
import {
  extractWordsWithPositions,
  normalizeWord,
} from "@uxie/shared/lib/tts/utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDocument, renderTextLayer } from "pdfjs-dist/legacy/build/pdf";
import { EventBus, PDFFindController } from "pdfjs-dist/legacy/web/pdf_viewer";
import { TextHighlighter } from "pdfjs-dist/lib/web/text_highlighter";
import { describe, expect, it } from "vitest";
import { fakeRangeClientRects, mountReader } from "./helpers/sentence-reader";

fakeRangeClientRects();

const QUERY = "reading";

async function renderDemoPageWithFindMatches() {
  const data = new Uint8Array(
    readFileSync(resolve(__dirname, "../../public/demo.pdf")),
  );
  const pdfDocument = await getDocument({ data }).promise;
  const pdfPage = await pdfDocument.getPage(1);

  document.body.innerHTML = "";
  const page = document.createElement("div");
  page.className = "page";
  page.setAttribute("data-page-number", "1");
  const textLayer = document.createElement("div");
  textLayer.className = "textLayer";
  page.appendChild(textLayer);
  document.body.appendChild(page);

  const textDivs: HTMLElement[] = [];
  const textContentItemsStr: string[] = [];
  await renderTextLayer({
    textContent: await pdfPage.getTextContent(),
    container: textLayer,
    viewport: pdfPage.getViewport({ scale: 1 }),
    textDivs,
    textContentItemsStr,
  }).promise;
  // What the reader marks once pdf.js reports the layer rendered.
  textLayer.setAttribute("data-text-complete", "");

  const eventBus = new EventBus();
  const findController = new PDFFindController({
    eventBus,
    linkService: { page: 1, pagesCount: pdfDocument.numPages } as never,
  });
  findController.setDocument(pdfDocument);
  const highlighter = new TextHighlighter({
    findController,
    eventBus,
    pageIndex: 0,
  });
  highlighter.setTextMapping(textDivs, textContentItemsStr);
  highlighter.enable();

  const pageOneSearched = new Promise<void>((done) =>
    eventBus.on(
      "updatetextlayermatches",
      ({ pageIndex }: { pageIndex: number }) => {
        if (pageIndex === 0 && findController.pageMatches?.[0]) done();
      },
    ),
  );
  eventBus.dispatch("find", {
    source: null,
    type: "again",
    query: QUERY,
    phraseSearch: true,
    caseSensitive: false,
    entireWord: false,
    highlightAll: true,
    findPrevious: false,
    matchDiacritics: false,
  });
  await pageOneSearched;

  return { textDivs, pdfDocument, highlighter };
}

describe("TTS highlighting while pdf.js find highlights are on the page", () => {
  it("covers exactly the spoken words of sentences containing find matches", async () => {
    const { textDivs, pdfDocument, highlighter } =
      await renderDemoPageWithFindMatches();

    const blocksWithMatches = textDivs.filter((div) =>
      div.querySelector(".highlight"),
    );
    expect(blocksWithMatches.length).toBeGreaterThan(1);
    expect(blocksWithMatches.every((div) => div.childNodes.length > 1)).toBe(
      true,
    );

    const api = mountReader();
    let pos = api.startFromPage(1);
    let sentencesWithMatches = 0;
    while (pos) {
      if (pos.sentence.toLowerCase().includes(QUERY)) {
        sentencesWithMatches++;
        const covered = Array.from(
          document.querySelectorAll(".tts-hl-sentence"),
        )
          .map((el) => el.getAttribute("data-hl-text") ?? "")
          .join("");
        expect(normalizeWord(covered)).toBe(normalizeWord(pos.sentence));

        api.resetWordTracking();
        const spoken = pos.sentenceForTts;
        for (const word of extractWordsWithPositions(spoken)) {
          if (!normalizeWord(word.word)) continue;
          api.highlightWord(word.charOffset, word.word.length, spoken);
          const highlighted = Array.from(
            document.querySelectorAll(".tts-hl-word"),
          )
            .map((el) => el.getAttribute("data-hl-text") ?? "")
            .join("");
          expect(normalizeWord(highlighted)).toBe(normalizeWord(word.word));
        }
      }
      pos = api.advanceToNextSentence();
    }
    expect(sentencesWithMatches).toBeGreaterThan(2);

    highlighter.disable();
    await pdfDocument.destroy();
  });
});

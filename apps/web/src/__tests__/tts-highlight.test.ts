import {
  useSentenceReader,
  type SentencePosition,
} from "@uxie/shared/hooks/use-sentence-reader";
import {
  computeChunkWordTimings,
  findChunkPosition,
  normalizeWord,
} from "@uxie/shared/lib/tts/utils";
import { TextSplitterStream } from "kokoro-js";
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import textlayer from "./fixtures/textlayer.json";

// Real pdf.js spans captured from public/demo.pdf. Re-capture by rendering it
// with renderTextLayer and dumping each span's text + getBoundingClientRect.
type FixtureSpan = { text: string; top: number; left: number; width: number };
const FIXTURE = textlayer as Record<string, FixtureSpan[]>;
const ALL_PAGES = Object.keys(FIXTURE)
  .map(Number)
  .sort((a, b) => a - b);

type ReaderApi = ReturnType<typeof useSentenceReader>;

// happy-dom has no layout, so every Range gets one fake rect and the assertions
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
Range.prototype.getClientRects = () =>
  ({
    length: 1,
    0: FAKE_RECT,
    item: () => FAKE_RECT,
  }) as unknown as DOMRectList;

function buildPageFromSpans(spans: FixtureSpan[], pageNumber = 1) {
  if (pageNumber === 1) document.body.innerHTML = "";
  const page = document.createElement("div");
  page.className = "page";
  page.setAttribute("data-page-number", String(pageNumber));
  for (const s of spans) {
    const el = document.createElement("span");
    el.setAttribute("role", "presentation");
    el.textContent = s.text;
    const rect = {
      top: s.top,
      left: s.left,
      width: s.width,
      height: 19,
      right: s.left + s.width,
      bottom: s.top + 19,
      x: s.left,
      y: s.top,
      toJSON() {},
    };
    el.getBoundingClientRect = () => rect as DOMRect;
    page.appendChild(el);
  }
  document.body.appendChild(page);
}

const buildPage = (pageNumber: number) =>
  buildPageFromSpans(FIXTURE[String(pageNumber)] ?? []);

function mountReader(pageCount = 1): ReaderApi {
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

/** Feeds a sentence through the same char indices onWordBoundary would receive,
 *  returning the text each word's overlay ended up covering. */
function readSentence(api: ReaderApi, pos: SentencePosition) {
  api.resetWordTracking();
  const spoken = pos.sentenceForTts;
  const splitter = new TextSplitterStream();
  splitter.push(spoken);
  splitter.close();
  const timings: ReturnType<typeof computeChunkWordTimings> = [];
  let searchStart = 0;
  let timeMs = 0;
  for (const chunk of [...splitter.sentences]) {
    const chunkStart = findChunkPosition(spoken, chunk, searchStart);
    if (chunkStart !== -1) {
      timings.push(
        ...computeChunkWordTimings(
          chunk,
          chunkStart,
          timeMs,
          chunk.length * 50,
        ),
      );
      searchStart = chunkStart + chunk.length;
    }
    timeMs += chunk.length * 50;
  }
  return timings.map((t) => {
    api.highlightWord(t.charIndex, t.charLength, spoken);
    const highlighted = Array.from(
      document.querySelectorAll(".tts-hl-word"),
    ).map((el) => el.getAttribute("data-hl-text") ?? "");
    return { spoken: t.word, highlighted };
  });
}

const isComplete = (sentence: string) => /[.!?”"]\s*$/.test(sentence.trim());

afterEach(() => vi.restoreAllMocks());

describe("TTS word highlighting over a real pdf.js text layer (demo.pdf)", () => {
  it("highlights every spoken word of every complete sentence — no skips, no whitespace, correct text", () => {
    let sentencesChecked = 0;
    let wordsChecked = 0;

    for (const pageNumber of ALL_PAGES) {
      buildPage(pageNumber);
      const api = mountReader();
      let pos = api.startFromPage(1);

      while (pos) {
        if (isComplete(pos.sentence)) {
          sentencesChecked++;
          for (const step of readSentence(api, pos)) {
            if (!normalizeWord(step.spoken)) continue; // skip pure-symbol tokens
            wordsChecked++;
            const joined = step.highlighted.join("");
            const where = `p${pageNumber} "${step.spoken}"`;

            expect(joined, `no highlight for ${where}`).not.toBe("");
            expect(
              /^\s|\s$/.test(joined),
              `whitespace in highlight for ${where}: ${JSON.stringify(joined)}`,
            ).toBe(false);
            expect(
              normalizeWord(joined),
              `${where}: highlight ${JSON.stringify(
                step.highlighted,
              )} != spoken`,
            ).toBe(normalizeWord(step.spoken));
          }
        }
        pos = api.advanceToNextSentence();
      }
    }

    expect(sentencesChecked).toBeGreaterThan(8);
    expect(wordsChecked).toBeGreaterThan(150);
  });

  // demo.pdf is left-aligned, so the justified-PDF edge cases below use
  // synthetic pages reproducing the span structure that broke highlighting.

  it("joins a word split across lines by a U+2010 hyphen and highlights both halves", () => {
    buildPageFromSpans([
      { text: "A careful reader can under‐", top: 0, left: 40, width: 300 },
      { text: "stand a dense passage fully.", top: 20, left: 40, width: 300 },
    ]);
    const api = mountReader();
    const pos = api.startFromPage(1);
    expect(pos).not.toBeNull();
    expect(pos!.sentence).toContain("under‐"); // hyphen preserved in source
    expect(pos!.sentenceForTts).toContain("understand"); // joined for speech
    expect(pos!.sentenceForTts).not.toContain("‐");

    const steps = readSentence(api, pos!);
    const word = steps.find((s) => normalizeWord(s.spoken) === "understand");
    expect(word, "'understand' not spoken").toBeDefined();
    expect(word!.highlighted.length).toBe(2);
    expect(word!.highlighted.join("")).toContain("‐");
    expect(normalizeWord(word!.highlighted.join(""))).toBe("understand");
  });

  it("reads ahead past the end of the page so a page turn has audio ready", () => {
    buildPageFromSpans(
      [{ text: "One fish. Two fish.", top: 0, left: 40, width: 200 }],
      1,
    );
    buildPageFromSpans(
      [{ text: "Red fish. Blue fish.", top: 0, left: 40, width: 200 }],
      2,
    );

    const api = mountReader(2);
    const first = api.startFromPage(1);
    expect(first?.sentence).toContain("One fish.");

    api.advanceToNextSentence();
    expect(api.getCurrentPage()).toBe(1);
    expect(api.peekUpcomingSentences(2)).toEqual(["Red fish.", "Blue fish."]);

    api.startFromPage(1);
    expect(api.peekUpcomingSentences(2)).toEqual(["Two fish.", "Red fish."]);
  });

  it("does not read ahead into pages pdf.js has not rendered", () => {
    buildPageFromSpans(
      [{ text: "One fish. Two fish.", top: 0, left: 40, width: 200 }],
      1,
    );

    const api = mountReader(3);
    api.startFromPage(1);
    api.advanceToNextSentence();
    expect(api.peekUpcomingSentences(2)).toEqual([]);
  });

  it("keeps the sentence and word highlights painted while text is selected", () => {
    buildPageFromSpans([
      { text: "One fish. Two fish.", top: 0, left: 40, width: 200 },
    ]);
    const api = mountReader();
    const pos = api.startFromPage(1);
    expect(pos).not.toBeNull();
    api.highlightWord(0, 3, pos!.sentenceForTts);

    const before = {
      sentence: document.querySelectorAll(".tts-hl-sentence").length,
      word: document.querySelectorAll(".tts-hl-word").length,
    };
    expect(before.sentence).toBeGreaterThan(0);
    expect(before.word).toBeGreaterThan(0);

    const span = document.querySelector("span[role='presentation']")!;
    const range = document.createRange();
    range.selectNodeContents(span);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));

    expect(document.querySelectorAll(".tts-hl-sentence").length).toBe(
      before.sentence,
    );
    expect(document.querySelectorAll(".tts-hl-word").length).toBe(before.word);
    for (const layer of document.querySelectorAll<HTMLElement>(
      ".tts-hl-layer",
    )) {
      expect(layer.style.visibility).not.toBe("hidden");
    }
  });

  it("paints overlays slightly larger than the glyph rect so the corners can round", () => {
    buildPageFromSpans([
      { text: "One fish. Two fish.", top: 0, left: 40, width: 200 },
    ]);
    const api = mountReader();
    const pos = api.startFromPage(1);
    api.highlightWord(0, 3, pos!.sentenceForTts);

    // FAKE_RECT is 8x8 at (0,0).
    const sentence = document.querySelector<HTMLElement>(".tts-hl-sentence")!;
    expect([sentence.style.left, sentence.style.top]).toEqual(["-2px", "0px"]);
    expect([sentence.style.width, sentence.style.height]).toEqual([
      "12px",
      "8px",
    ]);

    const word = document.querySelector<HTMLElement>(".tts-hl-word")!;
    expect([word.style.left, word.style.top]).toEqual(["-2px", "-1px"]);
    expect([word.style.width, word.style.height]).toEqual(["12px", "10px"]);
  });

  it("shortens the word-highlight glide when words arrive faster", () => {
    buildPageFromSpans([
      { text: "One fish and two fish.", top: 0, left: 40, width: 200 },
    ]);
    const api = mountReader();
    const pos = api.startFromPage(1);
    const spoken = pos!.sentenceForTts;
    const glide = () =>
      document
        .querySelector<HTMLElement>(".tts-hl-word")!
        .style.getPropertyValue("--tts-hl-glide");

    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    api.resetWordTracking();

    api.highlightWord(0, 3, spoken);
    now += 400;
    api.highlightWord(4, 4, spoken);
    expect(glide()).toBe("110ms"); // 400 * 0.45 clamps to the ceiling

    now += 100;
    api.highlightWord(9, 3, spoken);
    expect(glide()).toBe("45ms");
  });

  it("covers the whole sentence continuously across standalone inter-word space spans", () => {
    // Justified lines emit inter-word spaces as their own " " spans.
    buildPageFromSpans([
      { text: "Reading slowly", top: 0, left: 40, width: 120 },
      { text: " ", top: 0, left: 160, width: 6 },
      { text: "builds", top: 0, left: 166, width: 50 },
      { text: " ", top: 0, left: 216, width: 6 },
      { text: "real understanding.", top: 0, left: 222, width: 150 },
    ]);
    const api = mountReader();
    const pos = api.startFromPage(1);
    expect(pos).not.toBeNull();

    const covered = Array.from(document.querySelectorAll(".tts-hl-sentence"))
      .map((el) => el.getAttribute("data-hl-text") ?? "")
      .join("");
    expect(normalizeWord(covered)).toBe(normalizeWord(pos!.sentence));

    for (const step of readSentence(api, pos!)) {
      if (!normalizeWord(step.spoken)) continue;
      expect(normalizeWord(step.highlighted.join(""))).toBe(
        normalizeWord(step.spoken),
      );
    }
  });
});

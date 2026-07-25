import { describe, expect, it } from "vitest";
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
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
import textlayer from "./fixtures/textlayer.json";

// Real pdf.js text-layer spans captured from public/demo.pdf (the app's demo
// document), one entry per span with its on-screen geometry. Re-capture by
// rendering demo.pdf with pdf.js renderTextLayer and dumping each span's
// textContent + getBoundingClientRect (see scratchpad/render-demo.js).
type FixtureSpan = { text: string; top: number; left: number; width: number };
const FIXTURE = textlayer as Record<string, FixtureSpan[]>;
const ALL_PAGES = Object.keys(FIXTURE).map(Number).sort((a, b) => a - b);

type ReaderApi = ReturnType<typeof useSentenceReader>;

// happy-dom has no layout. Give every Range a single fake client rect so the
// overlay painters run; we assert only on the range's TEXT (stamped as
// data-hl-text), which is layout-independent. Visual alignment is verified
// against the live app, not here.
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
  ({ length: 1, 0: FAKE_RECT, item: () => FAKE_RECT }) as unknown as DOMRectList;

/** Build a single `.page` (as page 1) from a list of spans, each reporting its
 *  captured/synthetic geometry. Sentence detection is per-page. */
function buildPageFromSpans(spans: FixtureSpan[]) {
  document.body.innerHTML = "";
  const page = document.createElement("div");
  page.className = "page";
  page.setAttribute("data-page-number", "1");
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

function mountReader(): ReaderApi {
  const ref: { current: ReaderApi | null } = { current: null };
  const Host = () => {
    ref.current = useSentenceReader({ pageCount: 1 });
    return null;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  flushSync(() => createRoot(container).render(React.createElement(Host)));
  if (!ref.current) throw new Error("reader did not mount");
  return ref.current;
}

/** Simulate the TTS engine reading one sentence word-by-word — the char
 *  indices are exactly what onWordBoundary receives (kokoro's TextSplitterStream
 *  chunking) — and return the text each word's highlight overlay covers
 *  (data-hl-text = the Range's text). */
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
        ...computeChunkWordTimings(chunk, chunkStart, timeMs, chunk.length * 50),
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
              `${where}: highlight ${JSON.stringify(step.highlighted)} != spoken`,
            ).toBe(normalizeWord(step.spoken));
          }
        }
        pos = api.advanceToNextSentence();
      }
    }

    expect(sentencesChecked).toBeGreaterThan(8);
    expect(wordsChecked).toBeGreaterThan(150);
  });

  // demo.pdf is left-aligned (one span per line), so the edge cases below —
  // which come from justified PDFs — are exercised with synthetic pages whose
  // spans reproduce the exact structure that broke highlighting.

  it("joins a word split across lines by a U+2010 hyphen and highlights both halves", () => {
    // "under‐" ends line 1 (Unicode hyphen U+2010); "stand" begins line 2.
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
    // both halves highlighted at once, concatenating back to the word
    expect(word!.highlighted.length).toBe(2);
    expect(word!.highlighted.join("")).toContain("‐");
    expect(normalizeWord(word!.highlighted.join(""))).toBe("understand");
  });

  it("covers the whole sentence continuously across standalone inter-word space spans", () => {
    // pdf.js emits inter-word spaces as their own " " spans on justified lines.
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

    // The sentence range must cover every character — including the standalone
    // " " spans — or words would be dropped from the highlight.
    const covered = Array.from(document.querySelectorAll(".tts-hl-sentence"))
      .map((el) => el.getAttribute("data-hl-text") ?? "")
      .join("");
    expect(normalizeWord(covered)).toBe(normalizeWord(pos!.sentence));

    // And each word still highlights correctly with the space spans present.
    for (const step of readSentence(api, pos!)) {
      if (!normalizeWord(step.spoken)) continue;
      expect(normalizeWord(step.highlighted.join(""))).toBe(
        normalizeWord(step.spoken),
      );
    }
  });
});

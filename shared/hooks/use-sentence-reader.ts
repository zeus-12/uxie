import {
  buildWordMap,
  extractWordsWithPositions,
  LINE_BREAK_HYPHEN_JOIN,
  normalizeWhitespace,
  splitSentences,
  type NormalizedText,
  type WordMapEntry,
} from "../lib/tts/utils";
import { useCallback, useEffect, useRef } from "react";

export type HighlightMode = "tts" | "rsvp";

// Overlay <div>s rather than wrapped text nodes: the pdf text layer scaleX-es
// every span, which would shift a background painted inside one.
const OVERLAY_LAYER_CLASS = "tts-hl-layer";

// Sentence bands get no vertical padding — taller boxes make adjacent lines
// touch, which double-darkens the seam under mix-blend-mode: multiply.
const OVERLAY_PAD: Record<"sentence" | "word", { x: number; y: number }> = {
  sentence: { x: 2, y: 0 },
  word: { x: 2, y: 1 },
};

const GLIDE_FRACTION = 0.45;
const GLIDE_MIN_MS = 40;
const GLIDE_MAX_MS = 110;

const OVERLAY_CLASS: Record<
  "sentence" | "word",
  Record<HighlightMode, string>
> = {
  sentence: { tts: "tts-hl-sentence", rsvp: "tts-hl-rsvp-sentence" },
  word: { tts: "tts-hl-word", rsvp: "tts-hl-rsvp-word" },
};

function getHighlightClass(
  type: "sentence" | "word",
  mode: HighlightMode = "tts",
) {
  return OVERLAY_CLASS[type][mode];
}

export type SentencePosition = {
  pageNumber: number;
  sentenceIndex: number;
  sentence: string;
  sentenceForTts: string;
};

function getOverlayLayer(page: Element): HTMLElement {
  let layer = page.querySelector<HTMLElement>(`.${OVERLAY_LAYER_CLASS}`);
  if (!layer) {
    layer = document.createElement("div");
    layer.className = OVERLAY_LAYER_CLASS;
    page.appendChild(layer);
  }
  return layer;
}

function removeHighlightsByType(
  type: "sentence" | "word",
  mode?: HighlightMode,
) {
  const classNames = mode
    ? [OVERLAY_CLASS[type][mode]]
    : [OVERLAY_CLASS[type].tts, OVERLAY_CLASS[type].rsvp];
  for (const className of classNames) {
    document.querySelectorAll(`.${className}`).forEach((el) => el.remove());
  }
}

export function removeAllHighlights() {
  removeHighlightsByType("sentence");
  removeHighlightsByType("word");
}

export function cleanSentenceForTts(text: string): string {
  text = text.replace(/[\[\(]\d+[\]\)]/g, "");
  text = text.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, "");
  text = text.replace(/[●○■□▪▫◆◇★☆►▶◀◄→←↑↓↔↕⇒⇐⇑⇓•◦‣⁃∙·§¶†‡※⁂⁑⁕]/g, "");
  text = text.replace(/[≠≈≡≤≥±∓×÷∞∑∏∫∂√∛∜∝∀∃∄∅∈∉∋∌⊂⊃⊄⊅⊆⊇⊈⊉⊊⊋∪∩]/g, "");
  text = text.replace(/[─━│┃┄┅┆┇┈┉┊┋╌╍╎╏═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬]/g, "");
  text = text.replace(LINE_BREAK_HYPHEN_JOIN, "$1$2");
  return text.trim();
}

// Offsets are normalized (whitespace runs collapsed) — what sbd and the TTS
// engines see — and mapped back to raw DOM offsets only when highlighting.
type PageTextModel = {
  pageElement: Element;
  blocks: Element[];
  // 0 for whitespace-only blocks; excludes the separator space between blocks.
  blockRawLens: number[];
  blockStarts: number[];
  norm: NormalizedText;
  sentences: string[];
  sentenceStarts: number[];
};

function buildPageTextModel(pageElement: Element): PageTextModel {
  const blocks = Array.from(
    pageElement.querySelectorAll("span[role='presentation']"),
  );

  const blockRawLens: number[] = [];
  const blockStarts: number[] = [];
  let rawText = "";

  for (const block of blocks) {
    const text = block.textContent ?? "";
    blockStarts.push(rawText.length);
    if (text.trim().length === 0) {
      blockRawLens.push(0);
      continue;
    }
    blockRawLens.push(text.length);
    rawText += /\s$/.test(text) ? text : `${text} `;
  }

  const norm = normalizeWhitespace(rawText);

  const sentences: string[] = [];
  const sentenceStarts: number[] = [];
  let searchStart = 0;

  for (const sentence of splitSentences(norm.text)) {
    const pos = norm.text.indexOf(sentence, searchStart);
    if (pos !== -1) searchStart = pos + sentence.length;

    const cleaned = cleanSentenceForTts(sentence);
    const alphanumericCount = (cleaned.match(/[a-zA-Z0-9]/g) || []).length;
    if (alphanumericCount >= 3 && alphanumericCount / cleaned.length > 0.3) {
      sentences.push(sentence);
      sentenceStarts.push(pos);
    }
  }

  return {
    pageElement,
    blocks,
    blockRawLens,
    blockStarts,
    norm,
    sentences,
    sentenceStarts,
  };
}

function normRangeToRaw(
  norm: NormalizedText,
  normStart: number,
  normEnd: number,
): [number, number] | null {
  if (normStart < 0 || normEnd <= normStart || normEnd > norm.toRaw.length) {
    return null;
  }
  return [norm.toRaw[normStart]!, norm.toRaw[normEnd - 1]! + 1];
}

// Whitespace-only blocks and the synthetic inter-block separators occupy no
// real DOM, so a position landing on one snaps to the nearest content block.
function rawPosToDom(
  model: PageTextModel,
  rawPos: number,
  atEnd: boolean,
): { node: Node; offset: number } | null {
  for (let i = 0; i < model.blocks.length; i++) {
    const len = model.blockRawLens[i]!;
    if (len === 0) continue;
    const bs = model.blockStarts[i]!;
    const be = bs + len;
    const inside = atEnd
      ? rawPos > bs && rawPos <= be
      : rawPos >= bs && rawPos < be;
    if (inside) {
      const node = model.blocks[i]!.firstChild;
      if (!node) return null;
      return { node, offset: rawPos - bs };
    }
  }
  if (atEnd) {
    for (let i = model.blocks.length - 1; i >= 0; i--) {
      const len = model.blockRawLens[i]!;
      if (len === 0) continue;
      const be = model.blockStarts[i]! + len;
      const node = model.blocks[i]!.firstChild;
      if (be <= rawPos && node) return { node, offset: len };
    }
  } else {
    for (let i = 0; i < model.blocks.length; i++) {
      const len = model.blockRawLens[i]!;
      if (len === 0) continue;
      const node = model.blocks[i]!.firstChild;
      if (model.blockStarts[i]! >= rawPos && node) return { node, offset: 0 };
    }
  }
  return null;
}

function rawRangeToRange(
  model: PageTextModel,
  rawStart: number,
  rawEnd: number,
): Range | null {
  const s = rawPosToDom(model, rawStart, false);
  const e = rawPosToDom(model, rawEnd, true);
  if (!s || !e) return null;
  const range = document.createRange();
  try {
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
  } catch {
    return null;
  }
  return range.collapsed ? null : range;
}

type Rect = { left: number; top: number; width: number; height: number };

// getClientRects gives one rect per span, so a line arrives as several. Merging
// them into one band per line avoids sub-pixel seams and overlap double-darkening.
function mergeRectsByLine(rects: DOMRectList): Rect[] {
  const sorted = Array.from(rects)
    .filter((r) => r.width >= 0.5 && r.height >= 0.5)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const lines: { left: number; right: number; top: number; bottom: number }[] =
    [];
  for (const r of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(r.top - last.top) <= 4 && r.left <= last.right + 6) {
      last.left = Math.min(last.left, r.left);
      last.right = Math.max(last.right, r.right);
      last.top = Math.min(last.top, r.top);
      last.bottom = Math.max(last.bottom, r.bottom);
    } else {
      lines.push({
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
      });
    }
  }
  return lines.map((l) => ({
    left: l.left,
    top: l.top,
    width: l.right - l.left,
    height: l.bottom - l.top,
  }));
}

type Pad = { x: number; y: number };

function paintOverlays(
  range: Range,
  page: Element,
  className: string,
  pad: Pad,
): HTMLElement[] {
  const layer = getOverlayLayer(page);
  const origin = layer.getBoundingClientRect();
  const text = range.toString();
  const out: HTMLElement[] = [];
  for (const r of mergeRectsByLine(range.getClientRects())) {
    const el = document.createElement("div");
    el.className = className;
    el.setAttribute("data-hl-text", text);
    positionOverlay(el, r, origin, pad);
    layer.appendChild(el);
    out.push(el);
  }
  return out;
}

function positionOverlay(el: HTMLElement, r: Rect, origin: DOMRect, pad: Pad) {
  el.style.left = `${r.left - origin.left - pad.x}px`;
  el.style.top = `${r.top - origin.top - pad.y}px`;
  el.style.width = `${r.width + pad.x * 2}px`;
  el.style.height = `${r.height + pad.y * 2}px`;
}

// Reuses one element across words so it can transition; a hyphen-split word
// spanning two lines needs a second, non-animated rect.
function paintWordOverlay(
  range: Range,
  page: Element,
  className: string,
  glideMs: number,
) {
  const layer = getOverlayLayer(page);
  const origin = layer.getBoundingClientRect();
  const rects = mergeRectsByLine(range.getClientRects());
  const pad = OVERLAY_PAD.word;

  layer
    .querySelectorAll(`.${className}.tts-hl-word-extra`)
    .forEach((e) => e.remove());

  if (rects.length === 0) {
    layer.querySelectorAll(`.${className}`).forEach((e) => e.remove());
    return;
  }

  const text = range.toString();
  const isNew = !layer.querySelector(`.${className}:not(.tts-hl-word-extra)`);
  let primary = layer.querySelector<HTMLElement>(
    `.${className}:not(.tts-hl-word-extra)`,
  );
  if (!primary) {
    primary = document.createElement("div");
    primary.className = className;
    layer.appendChild(primary);
  }
  primary.setAttribute("data-hl-text", text);
  primary.style.setProperty("--tts-hl-glide", `${glideMs}ms`);

  // Snap across line wraps, or the highlight streaks diagonally down the page.
  const target = rects[0]!;
  const prevTop = parseFloat(primary.style.top || "NaN");
  const newTop = target.top - origin.top - pad.y;
  const jump = isNew || !(Math.abs(newTop - prevTop) <= 6);
  if (jump) primary.style.transition = "none";
  positionOverlay(primary, target, origin, pad);
  if (jump) {
    void primary.offsetHeight; // commit the snap before re-enabling transition
    primary.style.transition = "";
  }

  for (let i = 1; i < rects.length; i++) {
    const extra = document.createElement("div");
    extra.className = `${className} tts-hl-word-extra`;
    positionOverlay(extra, rects[i]!, origin, pad);
    layer.appendChild(extra);
  }
}

// react-pdf-highlighter names the scroller .PdfHighlighter; pdf.js's own viewer
// names it #viewerContainer.
export function getReaderScrollContainer(): HTMLElement | null {
  return (
    document.getElementById("viewerContainer") ??
    document.querySelector<HTMLElement>(".PdfHighlighter")
  );
}

// Follow-along's own scrollIntoView is indistinguishable from a user drag
// otherwise. scrollend is exact; the window is the fallback (Safari < 18.2).
const SCROLL_SETTLE_MS = 800;
let programmaticScrollUntil = 0;
let scrollEndWatcher: (() => void) | null = null;

function beginProgrammaticScroll() {
  programmaticScrollUntil =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) +
    SCROLL_SETTLE_MS;

  if (scrollEndWatcher || typeof window === "undefined") return;
  if (!("onscrollend" in window)) return;

  const container = getReaderScrollContainer();
  if (!container) return;

  const onScrollEnd = () => {
    programmaticScrollUntil = 0;
    container.removeEventListener("scrollend", onScrollEnd);
    scrollEndWatcher = null;
  };
  scrollEndWatcher = onScrollEnd;
  container.addEventListener("scrollend", onScrollEnd);
}

export function isProgrammaticScroll(): boolean {
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  return now < programmaticScrollUntil;
}

function scrollIntoCentre(el: Element) {
  beginProgrammaticScroll();
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function useSentenceReader({ pageCount }: { pageCount: number }) {
  const currentPageRef = useRef(1);
  const currentSentenceIndexRef = useRef(0);
  const modelRef = useRef<PageTextModel | null>(null);
  const wordMapRef = useRef<{ map: WordMapEntry[]; spoken: string } | null>(
    null,
  );
  const lastHighlightModeRef = useRef<HighlightMode>("tts");
  // Overlay rects go stale whenever the text layer re-renders; refreshHighlights
  // replays this after rebuilding the model.
  const repaintWordRef = useRef<(() => void) | null>(null);
  const lastWordBoundaryAtRef = useRef(0);
  const glideMsRef = useRef(GLIDE_MAX_MS);

  const loadPageSentences = useCallback((pageNumber: number): string[] => {
    const pageElement = document.querySelector(
      `.page[data-page-number="${pageNumber}"]`,
    );
    if (!pageElement) return [];

    const model = buildPageTextModel(pageElement);
    modelRef.current = model;
    currentPageRef.current = pageNumber;

    return model.sentences;
  }, []);

  // pdf.js re-renders the text layer by replacing the spans, so a model holding
  // the old ones yields stale rects. Different count or identity => re-rendered.
  const ensureFreshModel = useCallback(() => {
    const model = modelRef.current;
    const page = document.querySelector(
      `.page[data-page-number="${currentPageRef.current}"]`,
    );
    if (!model || !page) {
      loadPageSentences(currentPageRef.current);
      return;
    }
    const liveSpans = page.querySelectorAll("span[role='presentation']");
    if (
      liveSpans.length !== model.blocks.length ||
      liveSpans[0] !== model.blocks[0]
    ) {
      loadPageSentences(currentPageRef.current);
    }
  }, [loadPageSentences]);

  const highlightCurrentSentence = useCallback(
    (mode: HighlightMode = "tts") => {
      lastHighlightModeRef.current = mode;
      ensureFreshModel();
      const model = modelRef.current;
      const idx = currentSentenceIndexRef.current;
      const sentence = model?.sentences[idx];
      if (!model || !sentence) return;

      removeHighlightsByType("sentence", mode);

      const start = model.sentenceStarts[idx] ?? -1;
      if (start < 0) return;

      const raw = normRangeToRaw(model.norm, start, start + sentence.length);
      if (!raw) return;

      const range = rawRangeToRange(model, raw[0], raw[1]);
      if (!range) return;
      paintOverlays(
        range,
        model.pageElement,
        getHighlightClass("sentence", mode),
        OVERLAY_PAD.sentence,
      );
    },
    [ensureFreshModel],
  );

  const highlightWordInSentence = useCallback(
    (
      charOffsetInSentence: number,
      wordLength: number,
      mode: HighlightMode = "rsvp",
      removePreviousHighlights = true,
    ) => {
      ensureFreshModel();
      const model = modelRef.current;
      const idx = currentSentenceIndexRef.current;
      const sentence = model?.sentences[idx];
      if (!model || !sentence || wordLength <= 0) return;
      if (charOffsetInSentence < 0 || charOffsetInSentence >= sentence.length) {
        return;
      }

      const sentenceStart = model.sentenceStarts[idx] ?? -1;
      if (sentenceStart < 0) return;

      const end = Math.min(charOffsetInSentence + wordLength, sentence.length);

      const raw = normRangeToRaw(
        model.norm,
        sentenceStart + charOffsetInSentence,
        sentenceStart + end,
      );
      if (!raw) return;

      const range = rawRangeToRange(model, raw[0], raw[1]);
      if (!range) return;

      const className = getHighlightClass("word", mode);
      // false for the second half of a hyphen-split word: keep the first half.
      if (removePreviousHighlights) {
        paintWordOverlay(
          range,
          model.pageElement,
          className,
          glideMsRef.current,
        );
      } else {
        paintOverlays(
          range,
          model.pageElement,
          `${className} tts-hl-word-extra`,
          OVERLAY_PAD.word,
        );
      }

      repaintWordRef.current = () =>
        highlightWordInSentence(
          charOffsetInSentence,
          wordLength,
          mode,
          removePreviousHighlights,
        );
    },
    [ensureFreshModel],
  );

  const highlightWordByIndex = useCallback(
    (wordIndex: number, mode: HighlightMode = "rsvp") => {
      const sentence =
        modelRef.current?.sentences[currentSentenceIndexRef.current];
      if (!sentence) return;

      const word = extractWordsWithPositions(sentence)[wordIndex];
      if (!word) return;

      highlightWordInSentence(word.charOffset, word.word.length, mode);
    },
    [highlightWordInSentence],
  );

  const getCurrentSentence = useCallback((): SentencePosition | null => {
    const idx = currentSentenceIndexRef.current;
    const sentence = modelRef.current?.sentences[idx];
    if (!sentence) return null;

    return {
      pageNumber: currentPageRef.current,
      sentenceIndex: idx,
      sentence,
      sentenceForTts: cleanSentenceForTts(sentence),
    };
  }, []);

  const advanceToNextSentence = useCallback((): SentencePosition | null => {
    const nextIdx = currentSentenceIndexRef.current + 1;

    if (nextIdx < (modelRef.current?.sentences.length ?? 0)) {
      currentSentenceIndexRef.current = nextIdx;
      highlightCurrentSentence();
      return getCurrentSentence();
    }

    let nextPage = currentPageRef.current + 1;
    while (nextPage <= pageCount) {
      const sentences = loadPageSentences(nextPage);
      if (sentences.length > 0) {
        currentSentenceIndexRef.current = 0;
        highlightCurrentSentence();
        return getCurrentSentence();
      }
      nextPage++;
    }

    return null;
  }, [
    pageCount,
    loadPageSentences,
    highlightCurrentSentence,
    getCurrentSentence,
  ]);

  const goToPreviousSentence = useCallback((): SentencePosition | null => {
    const prevIdx = currentSentenceIndexRef.current - 1;

    if (prevIdx < 0) {
      const prevPage = currentPageRef.current - 1;
      if (prevPage < 1) {
        currentSentenceIndexRef.current = 0;
        highlightCurrentSentence();
        return getCurrentSentence();
      }

      const sentences = loadPageSentences(prevPage);
      if (sentences.length === 0) return null;

      currentSentenceIndexRef.current = sentences.length - 1;
      highlightCurrentSentence();
      return getCurrentSentence();
    }

    currentSentenceIndexRef.current = prevIdx;
    highlightCurrentSentence();
    return getCurrentSentence();
  }, [loadPageSentences, highlightCurrentSentence, getCurrentSentence]);

  const startFromPage = useCallback(
    (pageNumber: number): SentencePosition | null => {
      let currentPage = pageNumber;
      while (currentPage <= pageCount) {
        const sentences = loadPageSentences(currentPage);
        if (sentences.length > 0) {
          currentSentenceIndexRef.current = 0;
          highlightCurrentSentence();
          return getCurrentSentence();
        }
        currentPage++;
      }
      return null;
    },
    [
      pageCount,
      loadPageSentences,
      highlightCurrentSentence,
      getCurrentSentence,
    ],
  );

  const startFromTextOnPage = useCallback(
    (
      pageNumber: number,
      selectedText: string,
      selectionBlockIndex?: number,
      selectionOffsetInBlock?: number,
    ): SentencePosition | null => {
      const sentences = loadPageSentences(pageNumber);
      const model = modelRef.current;
      if (sentences.length === 0 || !model) return null;

      const normalised = selectedText.trim().replace(/\s+/g, " ");
      let bestIdx = -1;

      if (
        selectionBlockIndex !== undefined &&
        selectionBlockIndex >= 0 &&
        selectionBlockIndex < model.blocks.length
      ) {
        const blockLen = model.blockRawLens[selectionBlockIndex]!;
        const offsetInBlock = Math.min(
          selectionOffsetInBlock ?? 0,
          Math.max(blockLen - 1, 0),
        );
        const rawOffset =
          model.blockStarts[selectionBlockIndex]! + offsetInBlock;
        const normOffset = model.norm.fromRaw[rawOffset] ?? -1;

        if (normOffset >= 0) {
          for (let i = 0; i < sentences.length; i++) {
            const start = model.sentenceStarts[i]!;
            if (start < 0) continue;
            if (normOffset < start + sentences[i]!.length) {
              bestIdx = i;
              break;
            }
          }
          if (bestIdx === -1) bestIdx = sentences.length - 1;
        }
      }

      if (bestIdx === -1) {
        for (let i = 0; i < sentences.length; i++) {
          const s = sentences[i]!;
          if (s.includes(normalised) || normalised.includes(s.trim())) {
            bestIdx = i;
            break;
          }
        }
      }

      if (bestIdx === -1) {
        const selectedWords = new Set(normalised.toLowerCase().split(/\s+/));
        let bestScore = 0;
        for (let i = 0; i < sentences.length; i++) {
          const words = sentences[i]!.toLowerCase().split(/\s+/);
          const score = words.filter((w) => selectedWords.has(w)).length;
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
      }

      if (bestIdx === -1) bestIdx = 0;

      currentSentenceIndexRef.current = bestIdx;
      highlightCurrentSentence();
      return getCurrentSentence();
    },
    [loadPageSentences, highlightCurrentSentence, getCurrentSentence],
  );

  const reset = useCallback(() => {
    currentPageRef.current = 1;
    currentSentenceIndexRef.current = 0;
    modelRef.current = null;
    wordMapRef.current = null;
    removeAllHighlights();
  }, []);

  const scrollToCurrentSentence = useCallback(() => {
    const highlight =
      document.querySelector(`.${OVERLAY_CLASS.sentence.tts}`) ??
      document.querySelector(`.${OVERLAY_CLASS.sentence.rsvp}`);
    if (highlight) scrollIntoCentre(highlight);
  }, []);

  // Runs per word boundary: re-centring every time restarts the smooth scroll
  // faster than it can settle, so only scroll once the word leaves the middle.
  const keepCurrentWordVisible = useCallback(() => {
    const word =
      document.querySelector(`.${OVERLAY_CLASS.word.tts}`) ??
      document.querySelector(`.${OVERLAY_CLASS.word.rsvp}`);
    const container = getReaderScrollContainer();
    if (!word || !container) return;

    const view = container.getBoundingClientRect();
    const rect = word.getBoundingClientRect();
    const margin = view.height * 0.2;

    if (rect.top < view.top + margin || rect.bottom > view.bottom - margin) {
      scrollIntoCentre(word);
    }
  }, []);

  const highlightWord = useCallback(
    (charIndex: number, _charLength: number, spokenText?: string) => {
      // At 2x+ words outpace a fixed 110ms glide, leaving the overlay always
      // in flight, so size it to the measured cadence instead.
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const gap = lastWordBoundaryAtRef.current
        ? now - lastWordBoundaryAtRef.current
        : 0;
      lastWordBoundaryAtRef.current = now;
      if (gap > 0) {
        glideMsRef.current = Math.max(
          GLIDE_MIN_MS,
          Math.min(GLIDE_MAX_MS, gap * GLIDE_FRACTION),
        );
      }

      if (!wordMapRef.current && spokenText) {
        const sentence =
          modelRef.current?.sentences[currentSentenceIndexRef.current];
        if (sentence) {
          wordMapRef.current = {
            map: buildWordMap(sentence, spokenText),
            spoken: spokenText,
          };
        }
      }
      if (!wordMapRef.current) return;

      const { map, spoken } = wordMapRef.current;

      // Some engines report the boundary on the space before the word.
      let entry = map.find(
        (e) => charIndex >= e.cleanedOffset && charIndex < e.cleanedEnd,
      );
      if (!entry && spoken[charIndex] === " ") {
        entry = map.find((e) => e.cleanedOffset > charIndex);
      }
      if (!entry) return;

      const wordEntry = entry;
      const paint = () => {
        if (wordEntry.parts && wordEntry.parts.length > 1) {
          wordEntry.parts.forEach((part, idx) => {
            highlightWordInSentence(
              part.originalOffset,
              part.originalLength,
              "tts",
              idx === 0,
            );
          });
        } else {
          highlightWordInSentence(
            wordEntry.originalOffset,
            wordEntry.originalLength,
            "tts",
          );
        }
      };
      paint();
      repaintWordRef.current = paint;
    },
    [highlightWordInSentence],
  );

  // Drops the overlay too, or it glides across the page into the next sentence.
  const resetWordTracking = useCallback(() => {
    wordMapRef.current = null;
    repaintWordRef.current = null;
    lastWordBoundaryAtRef.current = 0;
    removeHighlightsByType("word");
  }, []);

  const resetToCurrentSentenceStart = useCallback(
    (mode: HighlightMode = "tts") => {
      wordMapRef.current = null;
      highlightCurrentSentence(mode);
    },
    [highlightCurrentSentence],
  );

  const refreshHighlights = useCallback(
    (mode?: HighlightMode) => {
      if (!modelRef.current) return;

      const modeToUse = mode ?? lastHighlightModeRef.current;
      const savedSentenceIdx = currentSentenceIndexRef.current;

      const sentences = loadPageSentences(currentPageRef.current);
      if (sentences.length === 0) return;

      currentSentenceIndexRef.current = Math.min(
        savedSentenceIdx,
        sentences.length - 1,
      );
      highlightCurrentSentence(modeToUse);
      repaintWordRef.current?.();
    },
    [loadPageSentences, highlightCurrentSentence],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const pageNumber = (e as CustomEvent).detail?.pageNumber;
      if (!modelRef.current) return;
      if (pageNumber !== undefined && pageNumber !== currentPageRef.current)
        return;
      refreshHighlights();
    };

    document.addEventListener("pdf:textlayerrendered", handler);
    return () => document.removeEventListener("pdf:textlayerrendered", handler);
  }, [refreshHighlights]);

  // Continues onto following pages so a page turn has audio ready. Pages pdf.js
  // hasn't rendered have no text layer, so the walk stops rather than guessing.
  const peekUpcomingSentences = useCallback(
    (count: number): string[] => {
      const upcoming: string[] = [];
      const model = modelRef.current;
      if (!model || count <= 0) return upcoming;

      for (
        let i = currentSentenceIndexRef.current + 1;
        i < model.sentences.length && upcoming.length < count;
        i++
      ) {
        upcoming.push(model.sentences[i]!);
      }

      for (
        let page = currentPageRef.current + 1;
        page <= pageCount && upcoming.length < count;
        page++
      ) {
        const pageElement = document.querySelector(
          `.page[data-page-number="${page}"]`,
        );
        if (!pageElement) break;

        for (const sentence of buildPageTextModel(pageElement).sentences) {
          if (upcoming.length >= count) break;
          upcoming.push(sentence);
        }
      }

      return upcoming;
    },
    [pageCount],
  );

  const getTotalSentences = useCallback(
    () => modelRef.current?.sentences.length ?? 0,
    [],
  );
  const getCurrentPage = useCallback(() => currentPageRef.current, []);

  return {
    startFromPage,
    startFromTextOnPage,
    advanceToNextSentence,
    goToPreviousSentence,
    getCurrentSentence,
    reset,
    highlightCurrentSentence,
    highlightWord,
    highlightWordByIndex,
    highlightWordInSentence,
    resetWordTracking,
    resetToCurrentSentenceStart,
    scrollToCurrentSentence,
    keepCurrentWordVisible,
    removeAllHighlights,
    refreshHighlights,
    peekUpcomingSentences,
    getTotalSentences,
    getCurrentPage,
  };
}

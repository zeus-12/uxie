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

// Highlights are painted as absolutely-positioned overlay <div>s (not by
// wrapping text nodes). The pdf text layer stretches every span with a
// `transform: scaleX(...)` to match the canvas; wrapping a sub-word in a
// background span misaligns the background from the scaled glyphs (the word
// looks shifted). Measuring the true on-screen rect with a DOM Range and
// painting an overlay at that rect avoids the transform entirely, keeps the
// text layer untouched, and — because a Range's per-line rects are continuous
// — leaves no gaps between words.
const OVERLAY_LAYER_CLASS = "tts-hl-layer";

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
  // Join words split across lines by a hyphen (ASCII or Unicode "‐", soft, …)
  text = text.replace(LINE_BREAK_HYPHEN_JOIN, "$1$2");
  return text.trim();
}

// All sentence and word offsets are expressed in normalized coordinates
// (whitespace runs collapsed to single spaces — the text sbd and the TTS
// engines actually see) and converted to raw DOM offsets only when
// highlighting. This keeps highlight positions exact even when the PDF text
// layer contains double spaces, NBSPs, or HTML-sensitive characters.
type PageTextModel = {
  pageElement: Element;
  blocks: Element[];
  // Length of each block's contribution to rawText, excluding the separator
  // space appended between blocks (0 for whitespace-only blocks).
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

// Maps a raw-text position to a DOM (textNode, offset). Content blocks are
// single text nodes; whitespace-only blocks (blockRawLen 0) and the synthetic
// inter-block separators occupy no real DOM, so a position landing on one is
// snapped to the nearest content block.
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
    const inside = atEnd ? rawPos > bs && rawPos <= be : rawPos >= bs && rawPos < be;
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

// getClientRects returns one rect per text run (per span), so a single line is
// several adjacent rects. Merge same-line rects into one band per line —
// otherwise sub-pixel seams show between words, and translucent overlays can't
// simply overlap (they'd double-darken).
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
      lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
  }
  return lines.map((l) => ({
    left: l.left,
    top: l.top,
    width: l.right - l.left,
    height: l.bottom - l.top,
  }));
}

// Paints one overlay per merged line-band of the range, positioned relative to
// the page's overlay layer. getClientRects reflects the scaleX transform, so
// overlays align exactly with the glyphs, and the merged bands are continuous.
function paintOverlays(
  range: Range,
  page: Element,
  className: string,
): HTMLElement[] {
  const layer = getOverlayLayer(page);
  const origin = layer.getBoundingClientRect();
  const text = range.toString();
  const out: HTMLElement[] = [];
  for (const r of mergeRectsByLine(range.getClientRects())) {
    const el = document.createElement("div");
    el.className = className;
    el.setAttribute("data-hl-text", text);
    el.style.left = `${r.left - origin.left}px`;
    el.style.top = `${r.top - origin.top}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
    layer.appendChild(el);
    out.push(el);
  }
  return out;
}

function positionOverlay(el: HTMLElement, r: Rect, origin: DOMRect) {
  el.style.left = `${r.left - origin.left}px`;
  el.style.top = `${r.top - origin.top}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
}

// The word highlight reuses one overlay element across words so its position
// can transition smoothly (the highlight glides to the next word). A word that
// wraps across a line break (hyphen-split) needs a second, non-animated rect.
function paintWordOverlay(range: Range, page: Element, className: string) {
  const layer = getOverlayLayer(page);
  const origin = layer.getBoundingClientRect();
  const rects = mergeRectsByLine(range.getClientRects());

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

  // Glide only within a line. When the next word is on a different line (or the
  // element is brand new), snap instead — otherwise the highlight streaks
  // diagonally across the whole page on every line wrap.
  const target = rects[0]!;
  const prevTop = parseFloat(primary.style.top || "NaN");
  const newTop = target.top - origin.top;
  const jump = isNew || !(Math.abs(newTop - prevTop) <= 6);
  if (jump) primary.style.transition = "none";
  positionOverlay(primary, target, origin);
  if (jump) {
    void primary.offsetHeight; // commit the snap before re-enabling transition
    primary.style.transition = "";
  }

  for (let i = 1; i < rects.length; i++) {
    const extra = document.createElement("div");
    extra.className = `${className} tts-hl-word-extra`;
    positionOverlay(extra, rects[i]!, origin);
    layer.appendChild(extra);
  }
}

export function useSentenceReader({ pageCount }: { pageCount: number }) {
  const currentPageRef = useRef(1);
  const currentSentenceIndexRef = useRef(0);
  const modelRef = useRef<PageTextModel | null>(null);
  const wordMapRef = useRef<{ map: WordMapEntry[]; spoken: string } | null>(
    null,
  );
  const lastHighlightModeRef = useRef<HighlightMode>("tts");
  // Replays the current word highlight. Overlay positions are absolute rects
  // from getClientRects, so they go stale when the pdf text layer re-renders
  // (font load, zoom, virtualization) — the glyphs move but the word overlay
  // doesn't. refreshHighlights replays this after rebuilding the model.
  const repaintWordRef = useRef<(() => void) | null>(null);

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

  // pdf.js re-renders the text layer by REPLACING the span elements. The model
  // caches references to those spans; a range built from a replaced span
  // returns a stale rect, so the highlight ends up offset. Before every
  // highlight, rebuild the model if the cached spans no longer match the live
  // ones (different count or identity => the layer re-rendered).
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
      paintOverlays(range, model.pageElement, getHighlightClass("sentence", mode));
    },
    [ensureFreshModel],
  );

  // Highlight a word in the current sentence by character offset and length.
  // charOffsetInSentence: where the word starts within the sentence
  // wordLength: length of the word to highlight
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
      // removePreviousHighlights=false is used for the second half of a
      // hyphen-split word, so keep the first half's overlay in place.
      if (removePreviousHighlights) {
        paintWordOverlay(range, model.pageElement, className);
      } else {
        paintOverlays(range, model.pageElement, `${className} tts-hl-word-extra`);
      }

      // Remember this single-word paint so it can be replayed after a text
      // layer re-render. For a hyphen-split word, highlightWord overwrites this
      // afterward with a parts-aware replay (see below).
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

    // Need to go to next page - loop until we find one with text
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

    return null; // End of document
  }, [pageCount, loadPageSentences, highlightCurrentSentence, getCurrentSentence]);

  const goToPreviousSentence = useCallback((): SentencePosition | null => {
    const prevIdx = currentSentenceIndexRef.current - 1;

    if (prevIdx < 0) {
      const prevPage = currentPageRef.current - 1;
      if (prevPage < 1) {
        // Stay at first
        currentSentenceIndexRef.current = 0;
        highlightCurrentSentence();
        return getCurrentSentence();
      }

      const sentences = loadPageSentences(prevPage);
      if (sentences.length === 0) return null;

      // Go to last sentence
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
    [pageCount, loadPageSentences, highlightCurrentSentence, getCurrentSentence],
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

      // Use the exact block + char offset captured on mouseup to find
      // the sentence at the user's actual selection position.
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
        const rawOffset = model.blockStarts[selectionBlockIndex]! + offsetInBlock;
        const normOffset = model.norm.fromRaw[rawOffset] ?? -1;

        if (normOffset >= 0) {
          // First sentence that ends after the selection point (i.e. the
          // sentence containing it, or the next one).
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

      // Fallback: text-based matching
      if (bestIdx === -1) {
        for (let i = 0; i < sentences.length; i++) {
          const s = sentences[i]!;
          if (s.includes(normalised) || normalised.includes(s.trim())) {
            bestIdx = i;
            break;
          }
        }
      }

      // Fallback: partial overlap — find sentence with most shared words
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
    if (highlight) {
      highlight.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const highlightWord = useCallback(
    (charIndex: number, _charLength: number, spokenText?: string) => {
      // Build word map lazily on first call for this sentence
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

      // Find which mapped word contains this charIndex in the cleaned text.
      // Some engines report the boundary on the whitespace before the word;
      // snap forward to the next word in that case.
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
      // Overwrite the single-word replay stored by highlightWordInSentence with
      // this parts-aware one, so a hyphen-split word repaints both halves.
      repaintWordRef.current = paint;
    },
    [highlightWordInSentence],
  );

  // Reset word tracking when starting a new sentence. Also drop the word
  // overlay so the animated highlight doesn't glide across the page from the
  // previous sentence's last word to the new sentence's first word.
  const resetWordTracking = useCallback(() => {
    wordMapRef.current = null;
    repaintWordRef.current = null;
    removeHighlightsByType("word");
  }, []);

  // Re-highlight the current sentence from its start (for speed change, voice change, restart)
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
      // The text layer just re-rendered with new span elements/scale, so the
      // absolutely-positioned word overlay is now stale — repaint it.
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

  // While the user is selecting text (to copy/annotate), hide the reading
  // highlight overlays. They sit over the same glyphs, so the green fills
  // otherwise show through the selection and make it look broken/gappy.
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = document.getSelection();
      const active =
        !!sel && !sel.isCollapsed && (sel.toString().trim().length ?? 0) > 0;
      document
        .querySelectorAll<HTMLElement>(`.${OVERLAY_LAYER_CLASS}`)
        .forEach((layer) => {
          layer.style.visibility = active ? "hidden" : "";
        });
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const getTotalSentences = useCallback(
    () => modelRef.current?.sentences.length ?? 0,
    [],
  );
  const getCurrentIndex = useCallback(
    () => currentSentenceIndexRef.current,
    [],
  );
  const getCurrentPage = useCallback(() => currentPageRef.current, []);
  const getSentences = useCallback(
    () => modelRef.current?.sentences ?? [],
    [],
  );

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
    removeAllHighlights,
    refreshHighlights,
    getTotalSentences,
    getCurrentIndex,
    getCurrentPage,
    getSentences,
  };
}

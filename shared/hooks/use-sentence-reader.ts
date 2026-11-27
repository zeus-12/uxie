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
import { toast } from "sonner";
import { usePdfTextStore } from "../lib/pdf-text";
import { REFLOW_LAYOUT_EVENT, requestReflowPage } from "../lib/reflow/reveal";

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

// Blocks are pdf.js's non-empty text items, so the model is surface-independent;
// offsets are whitespace-normalized (what sbd and TTS see), raw only to paint.
type PageTextModel = {
  pageNumber: number;
  blocks: string[];
  // 0 for whitespace-only blocks; excludes the separator space between blocks.
  blockRawLens: number[];
  blockStarts: number[];
  norm: NormalizedText;
  sentences: string[];
  sentenceStarts: number[];
};

const canvasPage = (pageNumber: number) =>
  document.querySelector(`.page[data-page-number="${pageNumber}"]`);

const canvasSpans = (pageNumber: number) =>
  Array.from(
    canvasPage(pageNumber)?.querySelectorAll<HTMLElement>(
      "span[role='presentation']",
    ) ?? [],
  );

const reflowSection = (pageNumber: number) =>
  document.querySelector<HTMLElement>(
    `.reflow-layer[data-active] [data-reflow-page="${pageNumber}"]`,
  );

// Set on a text layer once pdf.js reports it rendered; it streams in chunks.
export const TEXT_LAYER_COMPLETE = "data-text-complete";

// null when the page's text isn't known yet.
function pageBlocks(pageNumber: number): string[] | null {
  const cached = usePdfTextStore.getState().source?.blocks(pageNumber);
  if (cached) return cached;
  if (!canvasPage(pageNumber)?.querySelector(`.textLayer[${TEXT_LAYER_COMPLETE}]`)) return null;
  return canvasSpans(pageNumber).map((span) => span.textContent ?? "");
}

function buildPageTextModel(
  pageNumber: number,
  blocks: string[],
): PageTextModel {
  const blockRawLens: number[] = [];
  const blockStarts: number[] = [];
  let rawText = "";

  for (const text of blocks) {
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
    pageNumber,
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

// pdf.js find splits a block into text and match <span>s, so an offset into the
// block's text has to be resolved against its text nodes, not its first child.
function textPointInBlock(
  block: Element,
  offset: number,
  atEnd: boolean,
): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = (node as Text).data.length;
    if (atEnd ? remaining <= length : remaining < length) {
      return { node, offset: remaining };
    }
    remaining -= length;
  }
  return null;
}

type Segment = { block: number; from: number; to: number };

// Whitespace-only blocks and the separators between blocks have no characters
// on any surface, so a raw range becomes the block slices it covers.
function segmentsOf(
  model: PageTextModel,
  rawStart: number,
  rawEnd: number,
): Segment[] {
  const out: Segment[] = [];
  model.blocks.forEach((_, block) => {
    const len = model.blockRawLens[block]!;
    if (len === 0) return;
    const bs = model.blockStarts[block]!;
    const from = Math.max(rawStart, bs);
    const to = Math.min(rawEnd, bs + len);
    if (to > from) out.push({ block, from: from - bs, to: to - bs });
  });
  return out;
}

type Rect = { left: number; top: number; width: number; height: number };

function blockRects(el: Element, from: number, to: number): Rect[] {
  const s = textPointInBlock(el, from, false);
  const e = textPointInBlock(el, to, true);
  if (!s || !e) return [];
  const range = document.createRange();
  try {
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
  } catch {
    return [];
  }
  return Array.from(range.getClientRects());
}

// Text reflow shows as an image (a crop or a kept page) is laid out on the hidden
// canvas page; both render the same page, so its rects scale onto the image.
function projectOntoImage(
  section: HTMLElement,
  pageNumber: number,
  r: Rect,
): Rect | null {
  const page = canvasPage(pageNumber);
  if (!page) return null;
  const box = (page.querySelector(".canvasWrapper") ?? page).getBoundingClientRect();
  const pageW = Number(section.dataset.pageW);
  const pageH = Number(section.dataset.pageH);
  if (!box.width || !box.height || !pageW || !pageH) return null;
  const x = ((r.left - box.left) / box.width) * pageW;
  const y = ((r.top - box.top) / box.height) * pageH;
  const w = (r.width / box.width) * pageW;
  const h = (r.height / box.height) * pageH;
  for (const crop of section.querySelectorAll<HTMLElement>(".reflow-crop")) {
    const cx = Number(crop.dataset.cropX);
    const cy = Number(crop.dataset.cropY);
    const cw = Number(crop.dataset.cropW);
    const ch = Number(crop.dataset.cropH);
    if (x < cx || y < cy || x + w > cx + cw || y + h > cy + ch) continue;
    const image = crop.querySelector("canvas")?.getBoundingClientRect();
    if (!image || !image.width) return null;
    const k = image.width / cw;
    return {
      left: image.left + (x - cx) * k,
      top: image.top + (y - cy) * k,
      width: w * k,
      height: h * k,
    };
  }
  return null;
}

// The surface showing the page: reflowed text when the page is in the reflow
// window, otherwise pdf.js's canvas text layer.
function surfaceRects(
  model: PageTextModel,
  segments: Segment[],
): { host: Element; rects: Rect[] } | null {
  const section = reflowSection(model.pageNumber);
  const spans = canvasSpans(model.pageNumber);
  if (!section) {
    const host = canvasPage(model.pageNumber);
    if (!host) return null;
    return {
      host,
      rects: segments.flatMap((seg) => {
        const span = spans[seg.block];
        return span ? blockRects(span, seg.from, seg.to) : [];
      }),
    };
  }
  const runs = new Map<number, HTMLElement>();
  section
    .querySelectorAll<HTMLElement>("[data-item-ordinal]")
    .forEach((el) => runs.set(Number(el.dataset.itemOrdinal), el));
  const rects: Rect[] = [];
  for (const seg of segments) {
    const run = runs.get(seg.block);
    if (run) {
      const start = Number(run.dataset.runStart);
      const length = run.textContent?.length ?? 0;
      const from = Math.min(Math.max(seg.from - start, 0), length);
      const to = Math.min(Math.max(seg.to - start, 0), length);
      if (to > from) rects.push(...blockRects(run, from, to));
      continue;
    }
    const span = spans[seg.block];
    if (!span) continue;
    for (const r of blockRects(span, seg.from, seg.to)) {
      const projected = projectOntoImage(section, model.pageNumber, r);
      if (projected) rects.push(projected);
    }
  }
  return { host: section, rects };
}

// getClientRects gives one rect per span, so a line arrives as several. Merging
// them into one band per line avoids sub-pixel seams and overlap double-darkening.
function mergeRectsByLine(rects: Rect[]): Rect[] {
  const sorted = rects
    .filter((r) => r.width >= 0.5 && r.height >= 0.5)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const lines: { left: number; right: number; top: number; bottom: number }[] =
    [];
  for (const r of sorted) {
    const last = lines[lines.length - 1];
    const right = r.left + r.width;
    const bottom = r.top + r.height;
    if (last && Math.abs(r.top - last.top) <= 4 && r.left <= last.right + 6) {
      last.left = Math.min(last.left, r.left);
      last.right = Math.max(last.right, right);
      last.top = Math.min(last.top, r.top);
      last.bottom = Math.max(last.bottom, bottom);
    } else {
      lines.push({ left: r.left, right, top: r.top, bottom });
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
  rects: Rect[],
  host: Element,
  className: string,
  pad: Pad,
  text: string,
): HTMLElement[] {
  const layer = getOverlayLayer(host);
  const origin = layer.getBoundingClientRect();
  const out: HTMLElement[] = [];
  for (const r of mergeRectsByLine(rects)) {
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
  rawRects: Rect[],
  host: Element,
  className: string,
  glideMs: number,
  text: string,
) {
  const layer = getOverlayLayer(host);
  const origin = layer.getBoundingClientRect();
  const rects = mergeRectsByLine(rawRects);
  const pad = OVERLAY_PAD.word;

  document
    .querySelectorAll(`.${className}.tts-hl-word-extra`)
    .forEach((e) => e.remove());
  document
    .querySelectorAll(`.${className}`)
    .forEach((e) => e.parentElement !== layer && e.remove());

  if (rects.length === 0) {
    layer.querySelectorAll(`.${className}`).forEach((e) => e.remove());
    return;
  }

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

// The reflow layer scrolls while it shows; otherwise react-pdf-highlighter's
// .PdfHighlighter, or pdf.js's own #viewerContainer.
export function getReaderScrollContainer(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(".reflow-layer[data-active]") ??
    document.getElementById("viewerContainer") ??
    document.querySelector<HTMLElement>(".PdfHighlighter")
  );
}

// Follow-along's own scrollIntoView is indistinguishable from a user drag
// otherwise. scrollend is exact; the window is the fallback (Safari < 18.2).
const SCROLL_SETTLE_MS = 800;
let programmaticScrollUntil = 0;
let scrollEndWatcher: { container: HTMLElement; stop: () => void } | null =
  null;

export function beginProgrammaticScroll(
  container: HTMLElement | null = getReaderScrollContainer(),
) {
  programmaticScrollUntil =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) +
    SCROLL_SETTLE_MS;

  if (typeof window === "undefined" || !("onscrollend" in window)) return;
  if (!container || scrollEndWatcher?.container === container) return;
  scrollEndWatcher?.stop();

  const onScrollEnd = () => {
    programmaticScrollUntil = 0;
    stop();
  };
  const stop = () => {
    container.removeEventListener("scrollend", onScrollEnd);
    if (scrollEndWatcher?.container === container) scrollEndWatcher = null;
  };
  scrollEndWatcher = { container, stop };
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

// Reading moved past the reflowed pages: ask the reflow layer to show that
// page rather than follow along on the hidden canvas.
function revealReflowedPage(pageNumber: number): boolean {
  const layer = document.querySelector(".reflow-layer[data-active]");
  if (!layer || layer.querySelector(`[data-reflow-page="${pageNumber}"]`)) {
    return false;
  }
  requestReflowPage(pageNumber);
  return true;
}

export function useSentenceReader({ pageCount }: { pageCount: number }) {
  const currentPageRef = useRef(1);
  const reportedFailures = useRef(new Set<number>());
  const reportFailedPage = (page: number) => {
    if (reportedFailures.current.has(page)) return;
    reportedFailures.current.add(page);
    toast.error(`Couldn't read the text on page ${page}; skipping it`);
  };
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
  const revealPendingRef = useRef(false);

  // null when the page's text isn't known yet, so walks stop instead of skipping it.
  const loadPageSentences = useCallback((pageNumber: number): string[] | null => {
    const source = usePdfTextStore.getState().source;
    for (let page = pageNumber - 1; page <= pageNumber + 2; page++) source?.prefetch(page);
    const blocks = pageBlocks(pageNumber);
    if (!blocks) return null;

    const model = buildPageTextModel(pageNumber, blocks);
    modelRef.current = model;
    currentPageRef.current = pageNumber;

    return model.sentences;
  }, []);

  const ensureFreshModel = useCallback(() => {
    if (modelRef.current?.pageNumber !== currentPageRef.current) {
      loadPageSentences(currentPageRef.current);
    }
  }, [loadPageSentences]);

  const paintRange = useCallback(
    (normStart: number, normEnd: number) => {
      const model = modelRef.current;
      if (!model) return null;
      const raw = normRangeToRaw(model.norm, normStart, normEnd);
      if (!raw) return null;
      const surface = surfaceRects(model, segmentsOf(model, raw[0], raw[1]));
      if (!surface) return null;
      return { ...surface, text: model.norm.text.slice(normStart, normEnd) };
    },
    [],
  );

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

      const painted = paintRange(start, start + sentence.length);
      if (!painted) return;
      paintOverlays(
        painted.rects,
        painted.host,
        getHighlightClass("sentence", mode),
        OVERLAY_PAD.sentence,
        painted.text,
      );
    },
    [ensureFreshModel, paintRange],
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

      const painted = paintRange(
        sentenceStart + charOffsetInSentence,
        sentenceStart + end,
      );
      if (!painted) return;

      const className = getHighlightClass("word", mode);
      // false for the second half of a hyphen-split word: keep the first half.
      if (removePreviousHighlights) {
        paintWordOverlay(
          painted.rects,
          painted.host,
          className,
          glideMsRef.current,
          painted.text,
        );
      } else {
        paintOverlays(
          painted.rects,
          painted.host,
          `${className} tts-hl-word-extra`,
          OVERLAY_PAD.word,
          painted.text,
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
    [ensureFreshModel, paintRange],
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
      const blocks = pageBlocks(nextPage);
      if (!blocks && usePdfTextStore.getState().source?.failed(nextPage)) {
        reportFailedPage(nextPage);
        nextPage++;
        continue;
      }
      if (!blocks) return null;
      if (buildPageTextModel(nextPage, blocks).sentences.length > 0) {
        loadPageSentences(nextPage);
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
      for (let page = currentPageRef.current - 1; page >= 1; page--) {
        const blocks = pageBlocks(page);
        if (!blocks) {
          if (usePdfTextStore.getState().source?.failed(page)) continue;
          return null;
        }
        const count = buildPageTextModel(page, blocks).sentences.length;
        if (count === 0) continue;
        loadPageSentences(page);
        currentSentenceIndexRef.current = count - 1;
        highlightCurrentSentence();
        return getCurrentSentence();
      }
      currentSentenceIndexRef.current = 0;
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
        const blocks = pageBlocks(currentPage);
        if (!blocks && usePdfTextStore.getState().source?.failed(currentPage)) {
          reportFailedPage(currentPage);
          currentPage++;
          continue;
        }
        if (!blocks) return null;
        if (buildPageTextModel(currentPage, blocks).sentences.length > 0) {
          loadPageSentences(currentPage);
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
      if (!sentences || sentences.length === 0 || !model) return null;

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
    reportedFailures.current.clear();
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
    if (revealReflowedPage(currentPageRef.current)) {
      revealPendingRef.current = true;
      return;
    }
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
    if (revealReflowedPage(currentPageRef.current)) {
      revealPendingRef.current = true;
      return;
    }

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

      highlightCurrentSentence(mode ?? lastHighlightModeRef.current);
      repaintWordRef.current?.();
    },
    [highlightCurrentSentence],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const pageNumber = (e as CustomEvent).detail?.pageNumber;
      if (!modelRef.current) return;
      if (pageNumber !== undefined && pageNumber !== currentPageRef.current)
        return;
      refreshHighlights();
    };

    const onReflowLayout = (e: Event) => {
      handler(e);
      if (!revealPendingRef.current || !reflowSection(currentPageRef.current)) return;
      revealPendingRef.current = false;
      const highlight = document.querySelector(
        `.${OVERLAY_CLASS.sentence.tts}, .${OVERLAY_CLASS.sentence.rsvp}`,
      );
      if (highlight) scrollIntoCentre(highlight);
    };

    document.addEventListener("pdf:textlayerrendered", handler);
    document.addEventListener(REFLOW_LAYOUT_EVENT, onReflowLayout);
    return () => {
      document.removeEventListener("pdf:textlayerrendered", handler);
      document.removeEventListener(REFLOW_LAYOUT_EVENT, onReflowLayout);
    };
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
        const blocks = pageBlocks(page);
        if (!blocks) break;

        for (const sentence of buildPageTextModel(page, blocks).sentences) {
          if (upcoming.length >= count) break;
          upcoming.push(sentence);
        }
      }

      return upcoming;
    },
    [pageCount],
  );

  // Loads page text from `pageNumber` on, past genuinely empty pages, so the
  // synchronous walks below find it rather than stop on a page still loading.
  const ensureTextFrom = useCallback(
    async (pageNumber: number) => {
      const source = usePdfTextStore.getState().source;
      if (!source) return;
      for (let page = pageNumber; page <= pageCount; page++) {
        for (let ahead = 1; ahead <= 4; ahead++) source.prefetch(page + ahead);
        await source.ready(page);
        if (source.failed(page) && !pageBlocks(page)) continue;
        const blocks = source.blocks(page);
        if (!blocks || buildPageTextModel(page, blocks).sentences.length > 0) return;
      }
    },
    [pageCount],
  );

  // Loads page text backwards past genuinely empty pages, like ensureTextFrom.
  const preparePreviousSentence = useCallback(async () => {
    if (currentSentenceIndexRef.current > 0) return;
    const source = usePdfTextStore.getState().source;
    if (!source) return;
    for (let page = currentPageRef.current - 1; page >= 1; page--) {
      await source.ready(page);
      const blocks = source.blocks(page);
      if (!blocks && source.failed(page)) continue;
      if (!blocks || buildPageTextModel(page, blocks).sentences.length > 0) return;
    }
  }, []);

  const isPageTextKnown = useCallback((pageNumber: number) => pageBlocks(pageNumber) !== null, []);

  const prepareNextSentence = useCallback(async () => {
    const model = modelRef.current;
    if (!model) return;
    if (currentSentenceIndexRef.current + 1 < model.sentences.length) return;
    await ensureTextFrom(currentPageRef.current + 1);
  }, [ensureTextFrom]);

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
    ensureTextFrom,
    prepareNextSentence,
    preparePreviousSentence,
    isPageTextKnown,
  };
}

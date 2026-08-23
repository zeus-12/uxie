import sbd from "sbd";
import type { WordTiming } from "./types";

export type WordWithPosition = {
  word: string;
  index: number;
  charOffset: number;
};

export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return sbd.sentences(trimmed, {
    newline_boundaries: true,
    preserve_whitespace: false,
  });
}

export function extractWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

export function extractWordsWithPositions(text: string): WordWithPosition[] {
  const words = extractWords(text);
  const result: WordWithPosition[] = [];
  let searchStart = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;

    const charOffset = text.indexOf(word, searchStart);
    if (charOffset === -1) continue;
    searchStart = charOffset + word.length;

    result.push({ word, index: i, charOffset });
  }

  return result;
}

export function isRealWord(word: string): boolean {
  return /[a-zA-Z0-9]/.test(word);
}

// Line-break hyphens only — en/em dashes are punctuation, not word breaks.
const HYPHEN_CHARS = "\\u002d\\u2010\\u2011\\u00ad";
export const LINE_BREAK_HYPHEN_END = new RegExp(`[${HYPHEN_CHARS}]$`);
export const LINE_BREAK_HYPHEN_JOIN = new RegExp(
  `(\\w)[${HYPHEN_CHARS}]\\s+(\\w)`,
  "g",
);

export type NormalizedText = {
  text: string;
  toRaw: number[];
  fromRaw: number[];
};

// Collapses whitespace runs to match what sbd and the TTS engines see, keeping
// an offset map back to the raw string for DOM positioning.
export function normalizeWhitespace(raw: string): NormalizedText {
  let text = "";
  const toRaw: number[] = [];
  const fromRaw: number[] = new Array(raw.length);

  let i = 0;
  while (i < raw.length) {
    const ch = raw[i]!;
    if (/\s/.test(ch)) {
      const normIndex = text.length;
      text += " ";
      toRaw.push(i);
      while (i < raw.length && /\s/.test(raw[i]!)) {
        fromRaw[i] = normIndex;
        i++;
      }
    } else {
      fromRaw[i] = text.length;
      text += ch;
      toRaw.push(i);
      i++;
    }
  }

  return { text, toRaw, fromRaw };
}

export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/gi, "");
}

export type WordMapEntry = {
  cleanedOffset: number;
  cleanedEnd: number;
  originalOffset: number;
  originalLength: number;
  parts?: Array<{ originalOffset: number; originalLength: number }>;
};

export function buildWordMap(
  originalSentence: string,
  cleanedSentence: string,
): WordMapEntry[] {
  const origWords = extractWordsWithPositions(originalSentence);
  const cleanWords = extractWordsWithPositions(cleanedSentence);
  const map: WordMapEntry[] = [];
  let origIdx = 0;

  for (const cw of cleanWords) {
    const cwNorm = normalizeWord(cw.word);
    if (!cwNorm) {
      // Symbol-only token: match verbatim, stopping at the next real word so
      // it can't pair with a distant duplicate.
      for (let i = origIdx; i < origWords.length; i++) {
        const ow = origWords[i]!;
        if (ow.word === cw.word) {
          map.push({
            cleanedOffset: cw.charOffset,
            cleanedEnd: cw.charOffset + cw.word.length,
            originalOffset: ow.charOffset,
            originalLength: ow.word.length,
          });
          origIdx = i + 1;
          break;
        }
        if (normalizeWord(ow.word)) break;
      }
      continue;
    }

    for (let i = origIdx; i < origWords.length; i++) {
      const ow = origWords[i]!;
      const owNorm = normalizeWord(ow.word);
      if (!owNorm) continue;

      // Word split across lines by a hyphen.
      if (
        cwNorm.startsWith(owNorm) &&
        cwNorm !== owNorm &&
        LINE_BREAK_HYPHEN_END.test(ow.word) &&
        i + 1 < origWords.length
      ) {
        const nextOw = origWords[i + 1]!;
        const nextOwNorm = normalizeWord(nextOw.word);
        if (nextOwNorm === cwNorm.slice(owNorm.length)) {
          map.push({
            cleanedOffset: cw.charOffset,
            cleanedEnd: cw.charOffset + cw.word.length,
            originalOffset: ow.charOffset,
            originalLength: ow.word.length,
            parts: [
              { originalOffset: ow.charOffset, originalLength: ow.word.length },
              {
                originalOffset: nextOw.charOffset,
                originalLength: nextOw.word.length,
              },
            ],
          });
          origIdx = i + 2;
          break;
        }
      }

      if (
        cwNorm === owNorm ||
        owNorm.startsWith(cwNorm) ||
        cwNorm.startsWith(owNorm)
      ) {
        // The token may still hold characters the cleaner stripped, so
        // highlight only the part that was actually spoken.
        const exact = ow.word.indexOf(cw.word);
        map.push({
          cleanedOffset: cw.charOffset,
          cleanedEnd: cw.charOffset + cw.word.length,
          originalOffset: exact === -1 ? ow.charOffset : ow.charOffset + exact,
          originalLength: exact === -1 ? ow.word.length : cw.word.length,
        });
        origIdx = i + 1;
        break;
      }
    }
  }

  return map;
}

export function chunkText(text: string, maxLen = 300): string[] {
  const chunks: string[] = [];

  const paragraphs = text.split(/\n\n+/);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxLen) {
      chunks.push(trimmed);
      continue;
    }

    const sentences = splitSentences(trimmed);

    let current = "";
    for (const sent of sentences) {
      if ((current + " " + sent).trim().length > maxLen && current) {
        chunks.push(current.trim());
        current = sent;
      } else {
        current = current ? current + " " + sent : sent;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text.trim()];
}

export function findChunkPosition(
  fullText: string,
  chunk: string,
  searchStart: number,
): number {
  const trimmed = chunk.trim();
  const index = fullText.indexOf(trimmed, searchStart);
  if (index !== -1) return index;
  const words = trimmed.split(/\s+/);
  if (words.length > 0 && words[0]) {
    return fullText.indexOf(words[0], searchStart);
  }
  return searchStart;
}

const KOKORO_FRAMES_PER_SECOND = 40;
const PHONEME_EDGE_PUNCTUATION =
  /^[\s$;:,.!?¡¿—…"«»“”(){}\[\]]+|[\s$;:,.!?¡¿—…"«»“”(){}\[\]]+$/g;

type PhonemeUnit = {
  flatStart: number;
  flatEnd: number;
};

function flattenPhonemes(phonemes: string): {
  characters: string[];
  tokenIndices: number[];
  units: PhonemeUnit[];
} {
  const characters: string[] = [];
  const tokenIndices: number[] = [];
  const units: PhonemeUnit[] = [];

  for (const match of phonemes.matchAll(/\S+/g)) {
    const raw = match[0];
    const spoken = raw.replace(PHONEME_EDGE_PUNCTUATION, "");
    if (!spoken) continue;
    const leading = raw.indexOf(spoken);
    const flatStart = characters.length;
    for (let i = 0; i < spoken.length; i++) {
      characters.push(spoken[i]!);
      tokenIndices.push(match.index + leading + i);
    }
    units.push({ flatStart, flatEnd: characters.length });
  }

  return { characters, tokenIndices, units };
}

// Aligns the same sentence phonemized in connected-speech and word-separated
// modes. This transfers source-word boundaries only; all timestamps still come
// directly from the connected-speech model's measured duration tensor.
function alignPhonemeBoundaries(
  contextual: ReturnType<typeof flattenPhonemes>,
  separated: ReturnType<typeof flattenPhonemes>,
): number[] | null {
  const source = separated.characters;
  const target = contextual.characters;
  const width = target.length + 1;
  const costs = new Uint16Array((source.length + 1) * width);
  for (let i = 0; i <= source.length; i++) costs[i * width] = i;
  for (let j = 0; j <= target.length; j++) costs[j] = j;

  for (let i = 1; i <= source.length; i++) {
    for (let j = 1; j <= target.length; j++) {
      const substitution =
        costs[(i - 1) * width + j - 1]! +
        (source[i - 1] === target[j - 1] ? 0 : 1);
      const deletion = costs[(i - 1) * width + j]! + 1;
      const insertion = costs[i * width + j - 1]! + 1;
      costs[i * width + j] = Math.min(substitution, deletion, insertion);
    }
  }

  const sourceToTarget = new Array<number | undefined>(source.length);
  let i = source.length;
  let j = target.length;
  while (i > 0 || j > 0) {
    const current = costs[i * width + j]!;
    const diagonal =
      i > 0 && j > 0
        ? costs[(i - 1) * width + j - 1]! +
          (source[i - 1] === target[j - 1] ? 0 : 1)
        : Number.POSITIVE_INFINITY;
    if (diagonal === current) {
      sourceToTarget[i - 1] = j - 1;
      i--;
      j--;
    } else if (i > 0 && costs[(i - 1) * width + j]! + 1 === current) {
      i--;
    } else {
      j--;
    }
  }

  const starts = [0];
  for (let unitIndex = 1; unitIndex < separated.units.length; unitIndex++) {
    const left = separated.units[unitIndex - 1]!;
    const right = separated.units[unitIndex]!;
    let leftTarget: number | undefined;
    let rightTarget: number | undefined;
    for (let k = left.flatEnd - 1; k >= left.flatStart; k--) {
      if (sourceToTarget[k] !== undefined) {
        leftTarget = sourceToTarget[k];
        break;
      }
    }
    for (let k = right.flatStart; k < right.flatEnd; k++) {
      if (sourceToTarget[k] !== undefined) {
        rightTarget = sourceToTarget[k];
        break;
      }
    }

    // Any unassigned contextual phoneme at a word boundary makes that boundary
    // ambiguous, so reject the entire chunk instead of guessing which word owns it.
    if (
      leftTarget === undefined ||
      rightTarget === undefined ||
      leftTarget + 1 !== rightTarget
    ) {
      return null;
    }
    starts.push(rightTarget);
  }
  starts.push(target.length);
  return starts;
}

// Converts Kokoro's measured per-phoneme frame counts into source-word
// boundaries. The mapping is deliberately all-or-nothing: whitespace-delimited
// source words must match the phonemizer's word boundaries exactly.
export function wordTimingsFromPhonemeDurations(
  chunk: string,
  contextualPhonemes: string,
  separatedPhonemes: string,
  chunkOffset: number,
  chunkStartTimeMs: number,
  durations: Float32Array,
): WordTiming[] | null {
  if (durations.length !== contextualPhonemes.length + 2) return null;

  const sourceWords = extractWordsWithPositions(chunk).filter((word) =>
    isRealWord(word.word),
  );
  const contextual = flattenPhonemes(contextualPhonemes);
  const separated = flattenPhonemes(separatedPhonemes);
  if (sourceWords.length === 0 || sourceWords.length !== separated.units.length) {
    return null;
  }
  const wordStarts = alignPhonemeBoundaries(contextual, separated);
  if (!wordStarts || wordStarts.length !== sourceWords.length + 1) return null;
  for (let i = 0; i < sourceWords.length; i++) {
    if (wordStarts[i]! >= wordStarts[i + 1]!) return null;
  }

  const frameStarts = new Array<number>(durations.length + 1);
  let frame = 0;
  for (let i = 0; i < durations.length; i++) {
    frameStarts[i] = frame;
    frame += Math.round(durations[i]!);
  }
  frameStarts[durations.length] = frame;

  const toMs = (frames: number) =>
    chunkStartTimeMs + (frames / KOKORO_FRAMES_PER_SECOND) * 1000;

  return sourceWords.map((sourceWord, index) => {
    const flatStart = wordStarts[index]!;
    const flatEnd = wordStarts[index + 1]!;
    // +1 accounts for the tokenizer's BOS token.
    const first = contextual.tokenIndices[flatStart]! + 1;
    const last = contextual.tokenIndices[flatEnd - 1]! + 2;
    return {
      word: sourceWord.word,
      charIndex: chunkOffset + sourceWord.charOffset,
      charLength: sourceWord.word.length,
      startTime: toMs(frameStarts[first]!),
      endTime: toMs(frameStarts[last]!),
    };
  });
}

export function findCurrentWordIndex(
  timings: WordTiming[],
  elapsedMs: number,
): number {
  for (let i = 0; i < timings.length; i++) {
    const timing = timings[i]!;
    if (elapsedMs >= timing.startTime && elapsedMs < timing.endTime) {
      return i;
    }
  }

  if (timings.length > 0) {
    const lastTiming = timings[timings.length - 1]!;
    if (elapsedMs >= lastTiming.endTime) {
      return timings.length - 1;
    }
  }

  return -1;
}

export function combineSamples(
  allSamples: Float32Array[],
): Float32Array<ArrayBuffer> {
  const totalLength = allSamples.reduce((sum, arr) => sum + arr.length, 0);
  const combined = new Float32Array(totalLength);
  let offset = 0;
  for (const samples of allSamples) {
    combined.set(samples, offset);
    offset += samples.length;
  }
  return combined;
}

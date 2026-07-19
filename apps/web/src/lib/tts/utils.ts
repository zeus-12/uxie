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

// Hyphen characters that appear at the end of a line when a word is split
// across lines: ASCII hyphen-minus, Unicode hyphen, non-breaking hyphen,
// soft hyphen. (En/em dashes are punctuation, not word-break hyphens.)
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

// Collapses every whitespace run (spaces, NBSP, newlines) to a single " " so
// the result matches what sbd and the TTS engines operate on, while keeping
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
      // Symbol-only token ("<", "&", "—"): match it verbatim against
      // adjacent symbol tokens in the original; stop at the next real word
      // so it can't pair with a distant duplicate.
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

      // handle hyphenated word split across lines. PDFs use several hyphen
      // characters at line breaks (ASCII "-", U+2010 "‐", U+2011, soft hyphen).
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
        // The original token may contain characters the cleaner stripped
        // (footnote markers, superscripts). When the spoken word appears
        // verbatim inside the token, highlight only that part.
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

export function computeChunkWordTimings(
  chunk: string,
  chunkOffset: number,
  chunkStartTimeMs: number,
  chunkDurationMs: number,
): WordTiming[] {
  const words: { word: string; localIndex: number; charLength: number }[] = [];
  const wordRegex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(chunk)) !== null) {
    words.push({
      word: match[0],
      localIndex: match.index,
      charLength: match[0].length,
    });
  }

  if (words.length === 0) return [];

  const totalChars = words.reduce((sum, w) => sum + w.charLength, 0);
  const timings: WordTiming[] = [];
  let currentTime = chunkStartTimeMs;

  for (const wordInfo of words) {
    const charRatio = wordInfo.charLength / Math.max(totalChars, 1);
    const wordDuration = chunkDurationMs * charRatio;

    timings.push({
      word: wordInfo.word,
      charIndex: chunkOffset + wordInfo.localIndex,
      charLength: wordInfo.charLength,
      startTime: currentTime,
      endTime: currentTime + wordDuration,
    });

    currentTime += wordDuration;
  }

  return timings;
}

// Measures the leading/trailing silence in generated audio so word timings
// can be distributed over the region where speech actually occurs.
export function findVoicedRangeMs(
  samples: Float32Array,
  sampleRate: number,
  threshold = 0.005,
): { startMs: number; endMs: number } {
  let first = 0;
  while (first < samples.length && Math.abs(samples[first]!) < threshold) {
    first++;
  }

  if (first === samples.length) {
    return { startMs: 0, endMs: (samples.length / sampleRate) * 1000 };
  }

  let last = samples.length - 1;
  while (last > first && Math.abs(samples[last]!) < threshold) {
    last--;
  }

  return {
    startMs: (first / sampleRate) * 1000,
    endMs: ((last + 1) / sampleRate) * 1000,
  };
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

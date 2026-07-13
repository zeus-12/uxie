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
    if (!cwNorm) continue;

    for (let i = origIdx; i < origWords.length; i++) {
      const ow = origWords[i]!;
      const owNorm = normalizeWord(ow.word);
      if (!owNorm) continue;

      // handle hyphenated word split across lines
      if (
        cwNorm.startsWith(owNorm) &&
        cwNorm !== owNorm &&
        ow.word.endsWith("-") &&
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
        map.push({
          cleanedOffset: cw.charOffset,
          cleanedEnd: cw.charOffset + cw.word.length,
          originalOffset: ow.charOffset,
          originalLength: ow.word.length,
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

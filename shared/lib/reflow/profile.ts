import { median, weightedMode } from "./geometry";
import { buildLines, lineKey, type Line } from "./lines";
import type { DocumentProfile, MarginBand, PageInput } from "./types";

export const PROFILE_SAMPLE_SIZE = 16;
export const MARGIN_FRACTION = 0.2;

export const samplePageNumbers = (pageCount: number): number[] => {
  if (pageCount <= PROFILE_SAMPLE_SIZE) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const step = (pageCount - 1) / (PROFILE_SAMPLE_SIZE - 1);
  return Array.from(
    new Set(Array.from({ length: PROFILE_SAMPLE_SIZE }, (_, i) => 1 + Math.round(i * step))),
  );
};

const bodyLines = (page: PageInput) =>
  buildLines(page.items.filter((i) => i.horizontal && !i.artifact));

export const WORD_PATTERN = /\p{L}+/gu;

export type MarginZones = { top: Line[]; bottom: Line[] };

const ZONE_GAP_PITCHES = 1.3;

export const untaggedLine = (line: Line) => line.items.every((i) => i.markedId === null);

export const marginZones = (
  lines: Line[],
  pageHeight: number,
  pitch: number,
): MarginZones => {
  const sorted = [...lines].sort((a, b) => a.baseline - b.baseline);
  const collect = (ordered: Line[], inZone: (l: Line) => boolean, gapOf: (a: Line, b: Line) => number) => {
    for (let i = 0; i < ordered.length - 1; i++) {
      const a = ordered[i]!;
      if (!inZone(a)) return [];
      if (gapOf(a, ordered[i + 1]!) >= ZONE_GAP_PITCHES * pitch) return ordered.slice(0, i + 1);
    }
    return [];
  };
  return {
    top: collect(sorted, (l) => l.baseline < pageHeight * MARGIN_FRACTION, (a, b) => b.baseline - a.baseline),
    bottom: collect([...sorted].reverse(), (l) => l.baseline > pageHeight * (1 - MARGIN_FRACTION), (a, b) => a.baseline - b.baseline),
  };
};

export const buildProfile = (pages: PageInput[]): DocumentProfile => {
  const perPage = pages.map((p) => ({ page: p, lines: bodyLines(p) }));
  const allLines = perPage.flatMap((p) => p.lines);

  const bodyFontSize =
    weightedMode(
      allLines.map((l) => ({ value: l.fontSize, weight: l.text.trim().length })),
      0.25,
    ) ?? 10;

  const pitches: Array<{ value: number; weight: number }> = [];
  for (const { lines } of perPage) {
    const body = lines
      .filter((l) => Math.abs(l.fontSize - bodyFontSize) < 0.15 * bodyFontSize)
      .sort((a, b) => a.baseline - b.baseline);
    for (let i = 1; i < body.length; i++) {
      const a = body[i - 1]!;
      const b = body[i]!;
      const overlap = Math.min(a.rect.x + a.rect.width, b.rect.x + b.rect.width) - Math.max(a.rect.x, b.rect.x);
      const delta = b.baseline - a.baseline;
      if (overlap > 0 && delta > 0.9 * bodyFontSize && delta < 2.6 * bodyFontSize) {
        pitches.push({ value: delta, weight: 1 });
      }
    }
  }
  const linePitch = weightedMode(pitches, 0.25) ?? bodyFontSize * 1.2;
  const lineHeight = median(
    allLines
      .filter((l) => Math.abs(l.fontSize - bodyFontSize) < 0.15 * bodyFontSize)
      .map((l) => l.rect.height),
  ) || bodyFontSize;

  const bandVotes: Array<MarginBand & { votes: number }> = [];
  const vote = (band: MarginBand) => {
    const match = bandVotes.find(
      (b) =>
        b.edge === band.edge &&
        Math.abs(b.baseline - band.baseline) <= 2.5 &&
        Math.abs(b.fontSize - band.fontSize) <= 0.6,
    );
    if (match) match.votes += 1;
    else bandVotes.push({ ...band, votes: 1 });
  };
  const keyVotes = new Map<string, number>();
  const bodyLineKeys = new Set<string>();
  for (const { page, lines } of perPage) {
    const zones = marginZones(lines, page.height, linePitch);
    const zoned = new Set([...zones.top, ...zones.bottom]);
    for (const l of lines) if (!zoned.has(l) && l.text.length <= 80) bodyLineKeys.add(lineKey(l.text));
    const topEdge = zones.top[0];
    const bottomEdge = zones.bottom[0];
    if (topEdge && untaggedLine(topEdge)) vote({ edge: "top", baseline: topEdge.baseline, fontSize: topEdge.fontSize });
    if (bottomEdge && untaggedLine(bottomEdge)) vote({ edge: "bottom", baseline: bottomEdge.baseline, fontSize: bottomEdge.fontSize });
    const keys = new Set(
      [...zones.top, ...zones.bottom]
        .map((l) => lineKey(l.text))
        .filter((k) => k.replace(/[#\s]/g, "").length >= 3),
    );
    for (const k of keys) keyVotes.set(k, (keyVotes.get(k) ?? 0) + 1);
  }
  const quorum = Math.max(2, Math.ceil(pages.length * 0.3));
  const marginBands = bandVotes
    .filter((b) => b.votes >= quorum && b.fontSize <= bodyFontSize * 1.05)
    .map(({ edge, baseline, fontSize }) => ({ edge, baseline, fontSize }));
  const repeatedMarginKeys = [...keyVotes.entries()]
    .filter(([k, n]) => n >= Math.max(3, quorum) && !bodyLineKeys.has(k))
    .map(([k]) => k);

  const words = new Set<string>();
  for (const line of allLines) {
    for (const w of line.text.toLowerCase().match(WORD_PATTERN) ?? []) words.add(w);
  }

  return { bodyFontSize, linePitch, lineHeight, marginBands, repeatedMarginKeys, bodyLineKeys, words };
};

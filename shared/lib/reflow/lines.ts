import { right, union, weightedMode } from "./geometry";
import type { Rect, SourceItem } from "./types";

export type Line = {
  items: SourceItem[];
  seps: Array<"" | " ">;
  sups: boolean[];
  rect: Rect;
  baseline: number;
  fontSize: number;
  text: string;
};

const SEGMENT_GAP_EM = 1.2;
const SPACE_GAP_EM = 0.15;

const visible = (item: SourceItem) => item.str.trim().length > 0;

const dominantSize = (items: SourceItem[]) =>
  weightedMode(
    items.map((i) => ({ value: i.fontSize, weight: i.str.trim().length })),
    0.25,
  ) ?? items[0]!.fontSize;

type Group = { items: SourceItem[]; baseline: number; fontSize: number };

const groupByBaseline = (items: SourceItem[]): Group[] => {
  const sorted = [...items].sort((a, b) => a.baseline - b.baseline || a.rect.x - b.rect.x);
  const groups: Group[] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    const tolerance = 0.3 * Math.max(item.fontSize, last?.fontSize ?? 0);
    if (last && Math.abs(item.baseline - last.baseline) <= tolerance) {
      last.items.push(item);
      if (item.fontSize > last.fontSize) {
        last.fontSize = item.fontSize;
        last.baseline = item.baseline;
      }
    } else {
      groups.push({ items: [item], baseline: item.baseline, fontSize: item.fontSize });
    }
  }
  return groups;
};

const nearHorizontally = (item: SourceItem, others: SourceItem[], em: number) =>
  others.some(
    (o) => item.rect.x <= right(o.rect) + em && right(item.rect) >= o.rect.x - em,
  );

const attachScripts = (groups: Group[]): Map<SourceItem, boolean> => {
  const sup = new Map<SourceItem, boolean>();
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!;
    for (const item of [...g.items]) {
      for (const j of [i - 1, i + 1]) {
        const host = groups[j];
        if (!host || host.items.length === 0) continue;
        if (item.fontSize >= 0.85 * host.fontSize) continue;
        if (Math.abs(item.baseline - host.baseline) > 0.7 * host.fontSize) continue;
        if (!nearHorizontally(item, host.items, host.fontSize)) continue;
        sup.set(item, item.baseline < host.baseline);
        host.items.push(item);
        g.items.splice(g.items.indexOf(item), 1);
        break;
      }
    }
  }
  return sup;
};

export const buildLine = (items: SourceItem[], sup: Map<SourceItem, boolean>): Line => {
  const ordered = [...items].sort((a, b) => a.rect.x - b.rect.x);
  const fontSize = dominantSize(ordered);
  const main = ordered.filter((i) => !sup.get(i));
  const baseline = main.length > 0 ? main[0]!.baseline : ordered[0]!.baseline;
  const seps: Array<"" | " "> = [];
  let text = "";
  ordered.forEach((item, k) => {
    let sep: "" | " " = "";
    const prev = ordered[k - 1];
    if (prev && !/\s$/.test(prev.str) && !/^\s/.test(item.str)) {
      const gap = item.rect.x - right(prev.rect);
      if (gap > SPACE_GAP_EM * Math.min(prev.fontSize, item.fontSize)) sep = " ";
    }
    seps.push(sep);
    text += sep + item.str;
  });
  return {
    items: ordered,
    seps,
    sups: ordered.map((i) => sup.get(i) === true),
    rect: union(ordered.map((i) => i.rect)),
    baseline,
    fontSize,
    text,
  };
};

export const buildLines = (items: SourceItem[]): Line[] => {
  const groups = groupByBaseline(items.filter(visible));
  const sup = attachScripts(groups);
  const lines: Line[] = [];
  for (const g of groups) {
    if (g.items.length === 0) continue;
    const ordered = [...g.items].sort((a, b) => a.rect.x - b.rect.x);
    let segment: SourceItem[] = [];
    let segmentRight = -Infinity;
    for (const item of ordered) {
      const em = Math.max(g.fontSize, item.fontSize);
      if (segment.length > 0 && item.rect.x - segmentRight > SEGMENT_GAP_EM * em) {
        lines.push(buildLine(segment, sup));
        segment = [];
        segmentRight = -Infinity;
      }
      segment.push(item);
      segmentRight = Math.max(segmentRight, right(item.rect));
    }
    if (segment.length > 0) lines.push(buildLine(segment, sup));
  }
  return lines;
};

export const mergeLines = (a: Line, b: Line): Line => {
  const sup = new Map<SourceItem, boolean>();
  a.items.forEach((it, k) => sup.set(it, a.sups[k]!));
  b.items.forEach((it, k) => sup.set(it, b.sups[k]!));
  const merged = buildLine([...a.items, ...b.items], sup);
  return merged;
};

export const lineKey = (text: string) =>
  text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

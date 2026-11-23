import type { Rect } from "./types";

export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export const apply = (m: Matrix, x: number, y: number): [number, number] => [
  x * m[0] + y * m[2] + m[4],
  x * m[1] + y * m[3] + m[5],
];

export const toMatrix = (value: unknown): Matrix | null => {
  if (!Array.isArray(value) || value.length !== 6) return null;
  if (!value.every((v) => typeof v === "number" && Number.isFinite(v))) {
    return null;
  }
  return value as Matrix;
};

export const boundsOf = (points: Array<[number, number]>): Rect => {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

export const transformBox = (
  m: Matrix,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Rect =>
  boundsOf([apply(m, x0, y0), apply(m, x1, y0), apply(m, x0, y1), apply(m, x1, y1)]);

export const right = (r: Rect) => r.x + r.width;
export const bottom = (r: Rect) => r.y + r.height;
export const area = (r: Rect) => Math.max(0, r.width) * Math.max(0, r.height);

export const union = (rects: Rect[]): Rect => {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, right(r));
    y1 = Math.max(y1, bottom(r));
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
};

export const intersection = (a: Rect, b: Rect): Rect | null => {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(right(a), right(b));
  const y1 = Math.min(bottom(a), bottom(b));
  if (x1 < x0 || y1 < y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
};

export const clampTo = (r: Rect, width: number, height: number): Rect | null => {
  const clipped = intersection(r, { x: 0, y: 0, width, height });
  if (!clipped || clipped.width <= 0 || clipped.height <= 0) return null;
  return clipped;
};

export const inflate = (r: Rect, by: number): Rect => ({
  x: r.x - by,
  y: r.y - by,
  width: r.width + by * 2,
  height: r.height + by * 2,
});

export const overlapFraction = (inner: Rect, outer: Rect): number => {
  const a = area(inner);
  if (a === 0) {
    const cx = inner.x + inner.width / 2;
    const cy = inner.y + inner.height / 2;
    return cx >= outer.x && cx <= right(outer) && cy >= outer.y && cy <= bottom(outer)
      ? 1
      : 0;
  }
  const i = intersection(inner, outer);
  return i ? area(i) / a : 0;
};

export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

export const weightedMode = (
  entries: Array<{ value: number; weight: number }>,
  bucket: number,
): number | null => {
  const totals = new Map<number, { weight: number; sum: number }>();
  for (const { value, weight } of entries) {
    const key = Math.round(value / bucket);
    const t = totals.get(key) ?? { weight: 0, sum: 0 };
    t.weight += weight;
    t.sum += value * weight;
    totals.set(key, t);
  }
  let best: { weight: number; sum: number } | null = null;
  for (const t of totals.values()) if (!best || t.weight > best.weight) best = t;
  return best && best.weight > 0 ? best.sum / best.weight : null;
};

import {
  area,
  bottom,
  inflate,
  intersection,
  median,
  overlapFraction,
  right,
  union,
} from "./geometry";
import { buildLines, lineKey, mergeLines, type Line } from "./lines";
import { WORD_PATTERN, marginZones, untaggedLine } from "./profile";
import type {
  CropRegion,
  CropRole,
  DocumentProfile,
  HyphenDecision,
  HyphenJoin,
  KeepReason,
  PageInput,
  Rect,
  ReflowPage,
  Region,
  Run,
  TextRegion,
  TextRole,
} from "./types";

const RTL_SCRIPT = /[֐-ࣿיִ-﷿ﹰ-﻿]/g;
const BULLET_START = /^\s*[•●○◦▪■□‣⁃∙·*\uE000-\uF8FF]\s/;
const DASH_START = /^\s*[–—-]\s/;
const ENUM_START = /^\s*(?:\[\d{1,3}\]|\(?\d{1,3}[.)]|\(?[a-z][.)]|\(?(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)[.)])\s/;
const LINE_END_HYPHEN = /([\p{L}]+)[-‐]\s*$/u;
const SOFT_HYPHEN_END = /­\s*$/;
const FIRST_WORD = /^\s*(\p{L}+)/u;

type Ctx = {
  page: PageInput;
  profile: DocumentProfile;
  body: number;
  pitch: number;
  words: Set<string>;
  hyphens: HyphenJoin[];
};

type Atom =
  | { kind: "line"; rect: Rect; line: Line }
  | { kind: "crop"; rect: Rect; role: CropRole };

const charCount = (line: Line) => line.text.replace(/\s+/g, "").length;

const monoShare = (line: Line) => {
  let m = 0;
  let total = 0;
  for (const item of line.items) {
    const n = item.str.replace(/\s+/g, "").length;
    total += n;
    if (item.monospace === true) m += n;
  }
  return total === 0 ? 0 : m / total;
};

const structRole = (line: Line, page: PageInput): string | null => {
  const votes = new Map<string, number>();
  for (const item of line.items) {
    const role =
      (item.markedId ? page.structRoles[item.markedId] : undefined) ?? item.markedTag;
    if (!role) continue;
    votes.set(role, (votes.get(role) ?? 0) + item.str.length);
  }
  let best: string | null = null;
  let bestVotes = 0;
  for (const [role, n] of votes) if (n > bestVotes) [best, bestVotes] = [role, n];
  return best;
};

const marginLines = (lines: Line[], ctx: Ctx): Set<Line> => {
  const { page, profile, pitch } = ctx;
  const zones = marginZones(lines, page.height, pitch);
  const out = new Set<Line>();
  for (const [edge, zone] of [["top", zones.top], ["bottom", zones.bottom]] as const) {
    for (const line of zone) {
      const band = profile.marginBands.some(
        (b) =>
          b.edge === edge &&
          Math.abs(b.baseline - line.baseline) <= 2.5 &&
          Math.abs(b.fontSize - line.fontSize) <= 0.6,
      );
      const repeated = profile.repeatedMarginKeys.includes(lineKey(line.text));
      const pageNumber = /^[\s\-–—]*(?:page\s+)?(?:\d{1,4}|[ivxlcdm]{1,7})[\s\-–—]*$/i.test(line.text);
      const seenInBody = profile.bodyLineKeys.has(lineKey(line.text));
      if (repeated || (untaggedLine(line) && (pageNumber || (band && !seenInBody)))) out.add(line);
    }
  }
  return out;
};

const clusterRects = (rects: Rect[], reach: number): Rect[] => {
  const boxes = rects.map((r) => ({ rect: r, alive: true }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]!;
      if (!a.alive) continue;
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j]!;
        if (!b.alive) continue;
        if (intersection(inflate(a.rect, reach), b.rect)) {
          a.rect = union([a.rect, b.rect]);
          b.alive = false;
          merged = true;
        }
      }
    }
  }
  return boxes.filter((b) => b.alive).map((b) => b.rect);
};

const isolated = (line: Line, lines: Line[], ctx: Ctx) =>
  !lines.some(
    (o) =>
      o !== line &&
      charCount(o) > 12 &&
      Math.abs(o.baseline - line.baseline) <= 1.3 * ctx.pitch &&
      Math.min(right(o.rect), right(line.rect)) - Math.max(o.rect.x, line.rect.x) > -ctx.body,
  );

const isRule = (r: Rect) => Math.min(r.width, r.height) < 1.5;

const detectFigures = (lines: Line[], ctx: Ctx): Rect[] => {
  const { page, body } = ctx;
  const pageArea = page.width * page.height;
  const images = page.images.filter((r) => r.width >= 16 && r.height >= 16);
  const proseLines = lines.filter((l) => charCount(l) >= 35);
  const isTextPanel = (r: Rect) =>
    proseLines.filter((l) => overlapFraction(l.rect, r) >= 0.7).length >= 2;
  const drawn = page.paths.filter((r) => area(r) < 0.85 * pageArea && !isTextPanel(r));
  const figures = clusterRects([...images, ...drawn], 6).filter((r) => {
    if (area(r) < 0.004 * pageArea || r.width < 24 || r.height < 16) return false;
    const members = drawn.filter((p) => overlapFraction(p, r) >= 1);
    const shapes = members.filter((p) => !isRule(p)).length;
    const imageShare =
      images.reduce((s, im) => s + area(intersection(im, r) ?? { x: 0, y: 0, width: 0, height: 0 }), 0) / area(r);
    if (imageShare >= 0.3 || members.length >= 20) return true;
    if (shapes === 0 && members.length < 3 && imageShare === 0) return false;
    return !isTextPanel(r);
  });
  let result = figures;
  for (let pass = 0; pass < 2; pass++) {
    result = clusterRects(
      result.map((fig) => {
        const near = inflate(fig, 0.8 * body);
        const reach = inflate(fig, 3 * body);
        const labels = lines.filter(
          (l) =>
            overlapFraction(l.rect, fig) >= 0.6 ||
            (intersection(l.rect, near) && charCount(l) <= 30) ||
            (intersection(l.rect, reach) && charCount(l) <= 12 && isolated(l, lines, ctx)),
        );
        return union([fig, ...labels.map((l) => l.rect)]);
      }),
      0,
    );
  }
  return result;
};

const pageVerdict = (lines: Line[], figures: Rect[], ctx: Ctx): KeepReason | null => {
  const { page } = ctx;
  const allText = page.items.map((i) => i.str).join("");
  const letters = allText.replace(/\s+/g, "").length;
  const rtl = (allText.match(RTL_SCRIPT) ?? []).length;
  if (letters > 0 && rtl / letters > 0.05) return "right-to-left";
  const vertical = page.items
    .filter((i) => !i.horizontal || i.direction === "ttb")
    .reduce((s, i) => s + i.str.trim().length, 0);
  if (letters > 0 && vertical / letters > 0.2) return "vertical-text";
  const chars = lines.reduce((s, l) => s + charCount(l), 0);
  if (chars < 150) return "too-little-text";
  if (page.width > page.height * 1.05) return "landscape";
  if (page.formWidgetCount > 0) return "form";
  const pageArea = page.width * page.height;
  const cover = page.images.find((im) => area(im) >= 0.5 * pageArea);
  if (cover) {
    const underCover = lines
      .filter((l) => overlapFraction(l.rect, cover) >= 0.8)
      .reduce((s, l) => s + charCount(l), 0);
    if (underCover / chars >= 0.5) return "scanned";
  }
  const figureArea = figures.reduce((s, f) => s + area(f), 0);
  const inFigures = lines
    .filter((l) => figures.some((f) => overlapFraction(l.rect, f) >= 0.6))
    .reduce((s, l) => s + charCount(l), 0);
  if (figureArea / pageArea > 0.55 || inFigures / chars > 0.35) return "graphics-heavy";
  return null;
};

const groupAdjacent = (lines: Line[], pitch: number): Line[][] => {
  const sorted = [...lines].sort((a, b) => a.baseline - b.baseline);
  const groups: Line[][] = [];
  for (const line of sorted) {
    const group = groups.find((g) => {
      const last = g[g.length - 1]!;
      const xOverlap = Math.min(right(last.rect), right(line.rect)) - Math.max(last.rect.x, line.rect.x);
      return line.rect.y - bottom(last.rect) <= 1.2 * pitch && xOverlap > -pitch;
    });
    if (group) group.push(line);
    else groups.push([line]);
  }
  return groups;
};

const detectFlowCrops = (lines: Line[], ctx: Ctx): CropRegion[] => {
  const crops: CropRegion[] = [];
  const code = lines.filter((l) => monoShare(l) >= 0.8);
  for (const g of groupAdjacent(code, ctx.pitch)) {
    if (g.length < 2 && !g.every((l) => monoShare(l) === 1 && isolated(l, lines, ctx))) continue;
    crops.push({ kind: "crop", role: "code", rect: union(g.map((l) => l.rect)) });
  }
  const rules = ctx.page.paths.filter((r) => r.height < 1.5 && r.width >= 60);
  const families: Rect[][] = [];
  for (const r of [...rules].sort((a, b) => a.y - b.y)) {
    const fam = families.find(
      (f) => Math.abs(f[0]!.x - r.x) <= 6 && Math.abs(right(f[0]!) - right(r)) <= 6,
    );
    if (fam) fam.push(r);
    else families.push([r]);
  }
  for (const fam of families) {
    if (fam.length < 2) continue;
    const box = union(fam);
    if (box.height > 0.6 * ctx.page.height || box.height < 2 * ctx.pitch) continue;
    const inside = lines.filter((l) => overlapFraction(l.rect, box) >= 0.6);
    if (inside.length < 2) continue;
    const rows = new Map<number, number>();
    for (const l of inside) {
      const key = Math.round(l.baseline / 2);
      rows.set(key, (rows.get(key) ?? 0) + 1);
    }
    const multi = [...rows.values()].filter((n) => n >= 2).length;
    if (multi / rows.size >= 0.3) {
      crops.push({ kind: "crop", role: "table", rect: inflate(box, 1) });
    }
  }
  return crops;
};

type Interval = { from: number; to: number };

const gaps = (spans: Interval[], min: number): Interval[] => {
  const sorted = [...spans].sort((a, b) => a.from - b.from);
  const out: Interval[] = [];
  let reach = -Infinity;
  for (const s of sorted) {
    if (reach > -Infinity && s.from - reach >= min) out.push({ from: reach, to: s.from });
    reach = Math.max(reach, s.to);
  }
  return out;
};

const verticalGaps = (atoms: Atom[], min: number) =>
  gaps(atoms.map((a) => ({ from: a.rect.x, to: right(a.rect) })), min);

const horizontalGaps = (atoms: Atom[], min: number) =>
  gaps(atoms.map((a) => ({ from: a.rect.y, to: bottom(a.rect) })), min);

const lineAtoms = (atoms: Atom[]) =>
  atoms.filter((a): a is Extract<Atom, { kind: "line" }> => a.kind === "line");

const looksLikeTable = (left: Atom[], rightSide: Atom[], ctx: Ctx) => {
  const l = lineAtoms(left);
  const r = lineAtoms(rightSide);
  if (l.length < 2 || r.length < 2) return false;
  const short = (xs: typeof l) => median(xs.map((a) => charCount(a.line))) < 25;
  if (!short(l) && !short(r)) return false;
  const [few, many] = l.length <= r.length ? [l, r] : [r, l];
  const aligned = few.filter((a) =>
    many.some((b) => Math.abs(a.line.baseline - b.line.baseline) < 0.3 * ctx.body),
  ).length;
  return aligned / few.length >= 0.6;
};

const spansLines = (atoms: Atom[], ctx: Ctx) => {
  const r = union(atoms.map((a) => a.rect));
  return r.height >= 1.8 * ctx.pitch;
};

const xyCut = (atoms: Atom[], ctx: Ctx): Atom[][] => {
  if (atoms.length <= 1) return [atoms];
  const vMin = Math.max(ctx.body, 8);
  const vCandidates = verticalGaps(atoms, vMin)
    .map((g) => {
      const mid = (g.from + g.to) / 2;
      return {
        g,
        left: atoms.filter((a) => right(a.rect) <= mid),
        right: atoms.filter((a) => a.rect.x >= mid),
      };
    })
    .filter((c) => spansLines(c.left, ctx) && spansLines(c.right, ctx))
    .sort((a, b) => b.g.to - b.g.from - (a.g.to - a.g.from));
  const v = vCandidates[0];
  if (v) {
    if (looksLikeTable(v.left, v.right, ctx)) {
      const rect = union(atoms.map((a) => a.rect));
      return [[{ kind: "crop", role: "table", rect }]];
    }
    return [...xyCut(v.left, ctx), ...xyCut(v.right, ctx)];
  }
  const hMin = Math.max(0.45 * ctx.body, ctx.profile.linePitch - ctx.profile.lineHeight + 0.5 * ctx.body);
  for (const g of horizontalGaps(atoms, hMin)) {
    const mid = (g.from + g.to) / 2;
    const top = atoms.filter((a) => bottom(a.rect) <= mid);
    const rest = atoms.filter((a) => a.rect.y >= mid);
    const topGaps = verticalGaps(top, vMin);
    const restGaps = verticalGaps(rest, vMin);
    const throughColumns = topGaps.some((a) =>
      restGaps.some((b) => Math.min(a.to, b.to) - Math.max(a.from, b.from) > 0),
    );
    if (throughColumns && spansLines(top, ctx) && spansLines(rest, ctx)) continue;
    return [...xyCut(top, ctx), ...xyCut(rest, ctx)];
  }
  return [atoms];
};

const centre = (r: Rect) => r.x + r.width / 2;

const sizeClose = (a: number, b: number) => Math.abs(a - b) <= 0.12 * Math.max(a, b);

const LONE_MARKER = /^[•●○◦▪■□‣⁃∙·*o\u2013\u2014\-\uE000-\uF8FF]$/;

const startsWithBullet = (line: Line) =>
  BULLET_START.test(line.text) ||
  (line.items.length > 1 && LONE_MARKER.test(line.items[0]!.str.trim()) && line.seps[1] === " ");

const startsItem = (line: Line) =>
  startsWithBullet(line) || ENUM_START.test(line.text) || DASH_START.test(line.text);

const splitParagraphs = (lines: Line[], ctx: Ctx): Line[][] => {
  if (lines.length === 0) return [];
  const merged: Line[] = [];
  for (const line of [...lines].sort((a, b) => a.baseline - b.baseline || a.rect.x - b.rect.x)) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.baseline - line.baseline) <= 0.3 * Math.max(last.fontSize, line.fontSize)) {
      merged[merged.length - 1] = mergeLines(last, line);
    } else merged.push(line);
  }
  const leftEdge = Math.min(...merged.map((l) => l.rect.x));
  const rightEdge = Math.max(...merged.map((l) => right(l.rect)));
  const deltas: number[] = [];
  for (let i = 1; i < merged.length; i++) {
    if (sizeClose(merged[i]!.fontSize, merged[i - 1]!.fontSize)) {
      deltas.push(merged[i]!.baseline - merged[i - 1]!.baseline);
    }
  }
  const leafPitch = deltas.length >= 2 ? Math.min(...deltas.filter((d) => d > 0.8 * ctx.body).concat(Infinity)) : Infinity;
  const fullLines = merged.slice(0, -1).filter((l) => right(l.rect) >= rightEdge - 0.5 * ctx.body).length;
  const justified = merged.length > 2 && fullLines / (merged.length - 1) >= 0.7;

  const paragraphs: Line[][] = [];
  let current: Line[] = [];
  merged.forEach((line, i) => {
    const prev = merged[i - 1];
    const next = merged[i + 1];
    let brk = false;
    if (prev) {
      const em = line.fontSize;
      const pitch = Number.isFinite(leafPitch)
        ? leafPitch * (line.fontSize / prev.fontSize)
        : ctx.pitch * (line.fontSize / ctx.body);
      const first = current[0]!;
      const inItem = startsItem(first) && line.rect.x >= first.rect.x + 0.5 * em;
      if (!sizeClose(line.fontSize, prev.fontSize)) brk = true;
      else if (line.baseline - prev.baseline > 1.3 * pitch) brk = true;
      else if (startsWithBullet(line)) brk = true;
      else if (
        (ENUM_START.test(line.text) || DASH_START.test(line.text)) &&
        (startsItem(first) || right(prev.rect) < rightEdge - 2 * em)
      ) brk = true;
      else if (
        !inItem &&
        Math.abs(centre(line.rect) - centre(prev.rect)) > em &&
        line.rect.x > leftEdge + 0.6 * em &&
        prev.rect.x < line.rect.x - 0.6 * em &&
        (next
          ? next.rect.x < line.rect.x - 0.6 * em && next.baseline - line.baseline <= 1.3 * pitch
          : /[.!?:]["'\u201d\u2019)]*\s*$/.test(prev.text))
      ) brk = true;
      else if (justified && right(prev.rect) < rightEdge - 2 * em) brk = true;
      else if (
        !justified &&
        /[.!?:]["'”’)]*\s*$/.test(prev.text) &&
        right(prev.rect) < rightEdge - 0.25 * (rightEdge - leftEdge)
      ) brk = true;
      else if (
        current.length === 1 &&
        right(prev.rect) < leftEdge + 0.5 * (rightEdge - leftEdge) &&
        right(line.rect) > leftEdge + 0.8 * (rightEdge - leftEdge)
      ) brk = true;
      else if (
        !/[.,;:!?]["'\u201d\u2019)]*\s*$/.test(prev.text) &&
        right(prev.rect) < leftEdge + 0.5 * (rightEdge - leftEdge) &&
        line.baseline - prev.baseline > 1.1 * pitch
      ) brk = true;
    }
    if (brk && current.length > 0) {
      paragraphs.push(current);
      current = [];
    }
    current.push(line);
  });
  if (current.length > 0) paragraphs.push(current);
  return paragraphs;
};

const joinLines = (lines: Line[], ctx: Ctx): Run[] => {
  const runs: Run[] = [];
  let carried: "" | " " = "";
  lines.forEach((line, li) => {
    const next = lines[li + 1];
    let hyphen: HyphenDecision | null = null;
    if (next) {
      const head = next.text.match(FIRST_WORD)?.[1];
      const tail = line.text.match(LINE_END_HYPHEN)?.[1];
      if (SOFT_HYPHEN_END.test(line.text)) hyphen = "soft-hyphen";
      else if (tail && head) {
        const lowerHead = head[0] === head[0]!.toLowerCase();
        hyphen = lowerHead && ctx.words.has((tail + head).toLowerCase()) ? "word-evidence" : "kept";
      }
      if (hyphen) ctx.hyphens.push({ tail: tail ?? "", head: head ?? "", decision: hyphen });
    }
    line.items.forEach((item, k) => {
      let end = item.str.length;
      if (hyphen && k === line.items.length - 1) {
        end = item.str.replace(/\s+$/, "").length - (hyphen === "kept" ? 0 : 1);
      }
      runs.push({
        itemIndex: item.index,
        start: 0,
        end,
        sep: k === 0 ? carried : line.seps[k]!,
        sup: line.sups[k]!,
        rect: item.rect,
      });
    });
    carried = hyphen || /\s$/.test(line.text) ? "" : " ";
  });
  return runs.filter((r) => r.end > r.start);
};

const ROLE_FROM_TAG: Array<[RegExp, TextRole | CropRole]> = [
  [/^(?:Title|H|H\d)$/, "heading"],
  [/^(?:L|LI|Lbl|LBody)$/, "list-item"],
  [/^Caption$/, "caption"],
  [/^(?:Note|FENote|Footnote)$/, "footnote"],
  [/^(?:Table|TR|TH|TD|THead|TBody|TFoot)$/, "table"],
  [/^Formula$/, "equation"],
  [/^Code$/, "code"],
  [/^(?:P|Span|Quote|BlockQuote|Link|Reference|Sect|Div|Art|Part|Document|Lang)$/, "paragraph"],
];

const tagRole = (lines: Line[], page: PageInput): { role: TextRole | CropRole; level: 1 | 2 | 3 | null } | null => {
  const votes = new Map<string, number>();
  for (const l of lines) {
    const r = structRole(l, page);
    if (r) votes.set(r, (votes.get(r) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [r, c] of votes) if (c > n) [best, n] = [r, c];
  if (!best || n < lines.length / 2) return null;
  const tag = best;
  const hit = ROLE_FROM_TAG.find(([re]) => re.test(tag));
  if (!hit) return null;
  const digit = Number(tag.match(/^H(\d)$/)?.[1] ?? 2);
  const level = hit[1] === "heading" ? ((tag === "Title" ? 1 : Math.min(3, digit)) as 1 | 2 | 3) : null;
  return { role: hit[1], level };
};

const geometryRole = (
  lines: Line[],
  ctx: Ctx,
  neighbours: { prev: Line[] | null; next: Line[] | null },
): { role: TextRole; level: 1 | 2 | 3 | null } => {
  const size = median(lines.map((l) => l.fontSize));
  const scale = size / ctx.body;
  const text = lines.map((l) => l.text).join(" ");
  const chars = text.replace(/\s+/g, "").length;
  if (scale >= 1.15 && lines.length <= 4 && chars <= 250) {
    return { role: "heading", level: scale >= 1.6 ? 1 : scale >= 1.25 ? 2 : 3 };
  }
  const first = lines[0]!;
  const second = lines[1];
  if (startsWithBullet(first)) return { role: "list-item", level: null };
  if (ENUM_START.test(first.text)) {
    const hanging = second ? second.rect.x >= first.rect.x + 0.5 * first.fontSize : false;
    const siblings = [neighbours.prev, neighbours.next].some(
      (n) => n && ENUM_START.test(n[0]!.text) && Math.abs(n[0]!.rect.x - first.rect.x) < first.fontSize,
    );
    if (hanging || siblings) return { role: "list-item", level: null };
  }
  return { role: "paragraph", level: null };
};

const textRegion = (lines: Line[], role: TextRole, level: 1 | 2 | 3 | null, ctx: Ctx): TextRegion => {
  const size = median(lines.map((l) => l.fontSize));
  return {
    kind: "text",
    role,
    level,
    fontScale: size / ctx.body,
    runs: joinLines(lines, ctx),
    rect: union(lines.map((l) => l.rect)),
  };
};

export const reconstructPage = (page: PageInput, profile: DocumentProfile): ReflowPage => {
  const base = { pageNumber: page.pageNumber, width: page.width, height: page.height };
  const words = new Set(profile.words);
  const ctx: Ctx = {
    page,
    profile,
    body: profile.bodyFontSize,
    pitch: profile.linePitch,
    words,
    hyphens: [],
  };
  const usable = page.items.filter((i) => i.horizontal && !i.artifact && i.direction !== "ttb");
  if (usable.some((i) => !i.metricsKnown && i.str.trim())) {
    return { kind: "keep", ...base, reason: "unknown-font-metrics" };
  }
  const allLines = buildLines(usable);
  for (const l of allLines) for (const w of l.text.toLowerCase().match(WORD_PATTERN) ?? []) words.add(w);
  const margins = marginLines(allLines, ctx);
  const lines = allLines.filter((l) => !margins.has(l));

  const figures = detectFigures(lines, ctx);
  const verdict = pageVerdict(lines, figures, ctx);
  if (verdict) return { kind: "keep", ...base, reason: verdict };

  const crops: CropRegion[] = figures.map((rect) => ({ kind: "crop", role: "figure", rect }));
  const free = lines.filter((l) => !crops.some((c) => overlapFraction(l.rect, c.rect) >= 0.6));
  for (const c of detectFlowCrops(free, ctx)) {
    if (!crops.some((k) => overlapFraction(c.rect, k.rect) >= 0.8)) crops.push(c);
  }
  const textLines = lines.filter((l) => !crops.some((c) => overlapFraction(l.rect, c.rect) >= 0.6));

  const atoms: Atom[] = [
    ...crops.map((c): Atom => ({ kind: "crop", rect: c.rect, role: c.role })),
    ...textLines.map((line): Atom => ({ kind: "line", rect: line.rect, line })),
  ];
  const leaves = xyCut(atoms, ctx);

  const regions: Region[] = [];
  for (const leaf of leaves) {
    const items: Array<{ y: number; region: () => Region[] }> = [];
    for (const a of leaf) {
      if (a.kind === "crop") items.push({ y: a.rect.y, region: () => [{ kind: "crop", role: a.role, rect: a.rect }] });
    }
    const paragraphs = splitParagraphs(lineAtoms(leaf).map((a) => a.line), ctx);
    paragraphs.forEach((p, k) => {
      items.push({
        y: p[0]!.rect.y,
        region: () => {
          const tagged = tagRole(p, page);
          if (tagged && (tagged.role === "table" || tagged.role === "equation" || tagged.role === "code")) {
            return [{ kind: "crop", role: tagged.role, rect: union(p.map((l) => l.rect)) }];
          }
          const role = tagged && tagged.role !== "paragraph"
            ? { role: tagged.role as TextRole, level: tagged.level }
            : geometryRole(p, ctx, { prev: paragraphs[k - 1] ?? null, next: paragraphs[k + 1] ?? null });
          return [textRegion(p, role.role, role.level, ctx)];
        },
      });
    });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) regions.push(...it.region());
  }

  classifyCaptionsAndFootnotes(regions, ctx);
  if (!regions.some((r) => r.kind === "text")) return { kind: "keep", ...base, reason: "no-reflowable-text" };
  return { kind: "reflow", ...base, bodyFontSize: ctx.body, regions: mergeAdjacentCrops(regions), hyphens: ctx.hyphens };
};

const classifyCaptionsAndFootnotes = (regions: Region[], ctx: Ctx) => {
  const crops = regions.filter((r): r is CropRegion => r.kind === "crop" && r.role !== "equation");
  const bodyText = regions.filter((r): r is TextRegion => r.kind === "text" && r.fontScale >= 0.95);
  const xOverlap = (a: Rect, b: Rect) => Math.min(right(a), right(b)) - Math.max(a.x, b.x);
  for (const r of regions) {
    if (r.kind !== "text" || r.role !== "paragraph") continue;
    const nearCrop = crops.some((c) => {
      const dy = Math.min(Math.abs(r.rect.y - bottom(c.rect)), Math.abs(c.rect.y - bottom(r.rect)));
      return xOverlap(c.rect, r.rect) > 0 && dy <= 2 * ctx.pitch;
    });
    const above = bodyText.filter((b) => xOverlap(b.rect, r.rect) > 0 && bottom(b.rect) <= r.rect.y + 1);
    const below = bodyText.filter((b) => xOverlap(b.rect, r.rect) > 0 && b.rect.y >= bottom(r.rect) - 1);
    if (nearCrop && r.fontScale < 0.97) r.role = "caption";
    else if (
      r.fontScale <= 0.9 &&
      above.length > 0 &&
      below.length === 0 &&
      r.rect.y > ctx.page.height * 0.6
    ) r.role = "footnote";
  }
};

const mergeAdjacentCrops = (regions: Region[]): Region[] => {
  const out: Region[] = [];
  for (const r of regions) {
    const last = out[out.length - 1];
    if (last && last.kind === "crop" && r.kind === "crop" && intersection(last.rect, r.rect)) {
      out[out.length - 1] = {
        kind: "crop",
        role: last.role === "figure" || r.role === "figure" ? "figure" : last.role,
        rect: union([last.rect, r.rect]),
      };
    } else out.push(r);
  }
  return out;
};

export const regionText = (region: TextRegion, itemText: (index: number) => string): string =>
  region.runs.map((r) => r.sep + itemText(r.itemIndex).slice(r.start, r.end)).join("");

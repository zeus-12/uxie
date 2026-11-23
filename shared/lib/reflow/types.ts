export type Rect = { x: number; y: number; width: number; height: number };

export type SourceItem = {
  index: number;
  str: string;
  rect: Rect;
  baseline: number;
  fontSize: number;
  fontName: string;
  monospace: boolean | null;
  metricsKnown: boolean;
  horizontal: boolean;
  direction: string;
  hasEOL: boolean;
  markedTag: string | null;
  markedId: string | null;
  artifact: boolean;
};

export type PageInput = {
  pageNumber: number;
  width: number;
  height: number;
  items: SourceItem[];
  itemStrings: string[];
  images: Rect[];
  paths: Rect[];
  formWidgetCount: number;
  structRoles: Record<string, string>;
};

export type MarginBand = { edge: "top" | "bottom"; baseline: number; fontSize: number };

export type DocumentProfile = {
  bodyFontSize: number;
  linePitch: number;
  lineHeight: number;
  marginBands: MarginBand[];
  repeatedMarginKeys: string[];
  bodyLineKeys: Set<string>;
  words: Set<string>;
};

export type Run = {
  itemIndex: number;
  start: number;
  end: number;
  sep: "" | " ";
  sup: boolean;
  rect: Rect;
};

export type TextRole = "heading" | "paragraph" | "list-item" | "caption" | "footnote";

export type TextRegion = {
  kind: "text";
  role: TextRole;
  level: 1 | 2 | 3 | null;
  fontScale: number;
  runs: Run[];
  rect: Rect;
};

export type CropRole = "figure" | "table" | "equation" | "code";

export type CropRegion = { kind: "crop"; role: CropRole; rect: Rect };

export type Region = TextRegion | CropRegion;

export type KeepReason =
  | "too-little-text"
  | "right-to-left"
  | "vertical-text"
  | "landscape"
  | "form"
  | "scanned"
  | "graphics-heavy"
  | "unknown-font-metrics"
  | "no-reflowable-text";

export type HyphenDecision = "soft-hyphen" | "word-evidence" | "kept";

export type HyphenJoin = { tail: string; head: string; decision: HyphenDecision };

export type ReflowPage =
  | {
      kind: "reflow";
      pageNumber: number;
      width: number;
      height: number;
      bodyFontSize: number;
      regions: Region[];
      hyphens: HyphenJoin[];
    }
  | {
      kind: "keep";
      pageNumber: number;
      width: number;
      height: number;
      reason: KeepReason;
    };

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "red", "orange"] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = "yellow";

export const HIGHLIGHT_COLOR_LABELS: Record<HighlightColor, string> = {
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  red: "Pink",
  orange: "Orange",
};

export const isHighlightColor = (value: unknown): value is HighlightColor =>
  typeof value === "string" && (HIGHLIGHT_COLORS as readonly string[]).includes(value);

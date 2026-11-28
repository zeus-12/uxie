import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HIGHLIGHT_EXPORT_RGB,
  LIGHT_PALETTE_HSL,
  PAPER_HIGHLIGHT_ALPHA,
} from "../lib/annotated-pdf";
import { HIGHLIGHT_COLORS } from "../lib/highlight-colors";

const css = (file: string) => readFileSync(resolve(__dirname, "../styles", file), "utf8");

describe("highlight colours", () => {
  it("exports with the light theme's palette tokens", () => {
    const lightTheme = css("themes.css").split("}")[0]!;
    for (const color of HIGHLIGHT_COLORS) {
      const token = new RegExp(`--palette-${color}:\\s*([\\d.]+) ([\\d.]+)% ([\\d.]+)%;`).exec(
        lightTheme,
      );
      expect(token, color).not.toBeNull();
      expect(LIGHT_PALETTE_HSL[color]).toEqual(token!.slice(1).map(Number));
    }
  });

  it("exports at the alpha the page paints highlights with", () => {
    const paper = /\.uxie-pdf-page \{[^}]*--hl-alpha:\s*([\d.]+);/.exec(css("reader-page.css"));
    expect(Number(paper?.[1])).toBe(PAPER_HIGHLIGHT_ALPHA);
  });

  it("keeps yellow close to the highlight colour used before colours existed", () => {
    const [r, g, b] = HIGHLIGHT_EXPORT_RGB.yellow;
    const legacy = [255, 226, 143];
    expect(Math.hypot(r - legacy[0]!, g - legacy[1]!, b - legacy[2]!)).toBeLessThan(12);
  });

  it("has a styled fill for every colour on the page and in the popover", () => {
    const page = css("reader-page.css");
    const popover = css("selection-popover.css");
    for (const color of HIGHLIGHT_COLORS) {
      expect(page).toContain(`[data-highlight-color="${color}"]`);
      expect(popover).toContain(`[data-swatch="${color}"]`);
    }
  });
});

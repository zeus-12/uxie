import {
  isRetiredTheme,
  LIGHT_PRESET_THEMES,
  parseTheme,
  PRESET_THEMES,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
} from "@uxie/shared/lib/theme";
import { beforeEach, describe, expect, it } from "vitest";

function bootstrap(stored: string | null) {
  if (stored === null) localStorage.removeItem(THEME_STORAGE_KEY);
  else localStorage.setItem(THEME_STORAGE_KEY, stored);
  new Function(THEME_BOOTSTRAP_SCRIPT)();
  const root = document.documentElement;
  return { theme: root.dataset.theme, dark: root.classList.contains("dark") };
}

describe("theme migration", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  });

  it("falls back to dark for retired presets", () => {
    for (const retired of [
      "catppuccin-mocha",
      "everforest",
      "solarized-dark",
    ]) {
      expect(parseTheme(retired)).toBe("dark");
      expect(bootstrap(retired)).toEqual({ theme: "dark", dark: true });
    }
  });

  it("only treats the three removed presets as retired", () => {
    expect(isRetiredTheme("everforest")).toBe(true);
    expect(isRetiredTheme("some-future-preset")).toBe(false);
    expect(isRetiredTheme("hasOwnProperty")).toBe(false);
  });

  it("falls back to system for unknown values", () => {
    expect(parseTheme("constructor")).toBe("system");
    expect(parseTheme(null)).toBe("system");
    expect(bootstrap("constructor").theme).toBe("system");
    expect(bootstrap(null).theme).toBe("system");
  });

  it("paints light presets without the dark class", () => {
    for (const preset of PRESET_THEMES) {
      const light = (LIGHT_PRESET_THEMES as readonly string[]).includes(preset);
      expect(bootstrap(preset)).toEqual({ theme: preset, dark: !light });
    }
  });
});

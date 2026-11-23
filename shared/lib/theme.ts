export const APPEARANCE_THEMES = ["light", "dark", "system"] as const;
export const DARK_PRESET_THEMES = [
  "tokyo-night",
  "rose-pine",
  "kanagawa-wave",
  "ayu-mirage",
] as const;
export const LIGHT_PRESET_THEMES = [
  "tokyo-night-day",
  "rose-pine-dawn",
  "kanagawa-lotus",
  "ayu-light",
] as const;
export const PRESET_THEMES = [
  ...DARK_PRESET_THEMES,
  ...LIGHT_PRESET_THEMES,
] as const;
export const THEMES = [...APPEARANCE_THEMES, ...PRESET_THEMES] as const;

const RETIRED_THEMES = new Map<string, Theme>([
  ["catppuccin-mocha", "dark"],
  ["everforest", "dark"],
  ["solarized-dark", "dark"],
]);

export type Theme = (typeof THEMES)[number];
export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number];
export type PresetTheme = (typeof PRESET_THEMES)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "uxie-theme";

export function isTheme(value: unknown): value is Theme {
  return (THEMES as readonly unknown[]).includes(value);
}

export function isRetiredTheme(value: string): boolean {
  return RETIRED_THEMES.has(value);
}

export function parseTheme(value: unknown): Theme {
  if (isTheme(value)) return value;
  return (typeof value === "string" && RETIRED_THEMES.get(value)) || "system";
}

export function isPresetTheme(theme: Theme): theme is PresetTheme {
  return (PRESET_THEMES as readonly Theme[]).includes(theme);
}

export function isLightTheme(theme: Exclude<Theme, "system">): boolean {
  return (
    theme === "light" ||
    (LIGHT_PRESET_THEMES as readonly Theme[]).includes(theme)
  );
}

// Serialized into a <script> tag by each host so the first frame already has
// the stored theme; it must stay self-contained.
export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  const themes = ${JSON.stringify(THEMES)};
  const lightThemes = ${JSON.stringify(["light", ...LIGHT_PRESET_THEMES])};
  const retired = ${JSON.stringify(Object.fromEntries(RETIRED_THEMES))};
  let stored = null;
  try {
    stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  } catch {}
  const theme = themes.includes(stored)
    ? stored
    : Object.prototype.hasOwnProperty.call(retired, stored)
      ? retired[stored]
      : "system";
  const dark = theme === "system"
    ? matchMedia("(prefers-color-scheme: dark)").matches
    : !lightThemes.includes(theme);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", dark);
})();`;

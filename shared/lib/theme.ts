export const APPEARANCE_THEMES = ["light", "dark", "system"] as const;
export const PRESET_THEMES = [
  "tokyo-night",
  "catppuccin-mocha",
  "rose-pine",
  "kanagawa-wave",
  "ayu-mirage",
  "everforest",
  "solarized-dark",
] as const;
export const THEMES = [...APPEARANCE_THEMES, ...PRESET_THEMES] as const;

export type Theme = (typeof THEMES)[number];
export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number];
export type PresetTheme = (typeof PRESET_THEMES)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "uxie-theme";

export function isTheme(value: unknown): value is Theme {
  return (THEMES as readonly unknown[]).includes(value);
}

export function parseTheme(value: unknown): Theme {
  return isTheme(value) ? value : "system";
}

export function isPresetTheme(theme: Theme): theme is PresetTheme {
  return (PRESET_THEMES as readonly Theme[]).includes(theme);
}

// Serialized into a <script> tag by each host so the first frame already has
// the stored theme; it must stay self-contained.
export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  const themes = ${JSON.stringify(THEMES)};
  let stored = null;
  try {
    stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  } catch {}
  const theme = themes.includes(stored) ? stored : "system";
  const dark = theme === "system"
    ? matchMedia("(prefers-color-scheme: dark)").matches
    : theme !== "light";
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", dark);
})();`;

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

export function parseTheme(value: unknown): Theme {
  switch (value) {
    case "light":
    case "dark":
    case "system":
    case "tokyo-night":
    case "catppuccin-mocha":
    case "rose-pine":
    case "kanagawa-wave":
    case "ayu-mirage":
    case "everforest":
    case "solarized-dark":
      return value;
    default:
      return "system";
  }
}

// Runs before React in both Next.js and Electron so the first painted frame
// already uses the persisted theme. Keep this dependency-free: it is serialized
// directly into a <script> tag by each host.
export const THEME_BOOTSTRAP_SCRIPT = `
(() => {
  const key = "${THEME_STORAGE_KEY}";
  const themes = ${JSON.stringify(THEMES)};
  let stored = null;
  try {
    stored = localStorage.getItem(key);
  } catch {}
  const theme = themes.includes(stored) ? stored : "system";
  const resolved = theme === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
})();
`;

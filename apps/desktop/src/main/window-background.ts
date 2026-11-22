import { app, nativeTheme } from "electron";
import { readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";

const RGB = /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/;

const file = () => join(app.getPath("userData"), "window-background.json");

export function isWindowBackground(value: unknown): value is string {
  return typeof value === "string" && RGB.test(value);
}

// The renderer paints the theme's background only once it loads, so the
// window opens on the colour it last reported to avoid a flash of another one.
export function getWindowBackground(): string {
  const stored = readStored();
  if (stored) return stored;
  return nativeTheme.shouldUseDarkColors ? "#141417" : "#ffffff";
}

function readStored(): string | null {
  try {
    const stored: unknown = JSON.parse(readFileSync(file(), "utf8"));
    return isWindowBackground(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function setWindowBackground(colour: string): void {
  const tmp = file() + ".tmp";
  writeFileSync(tmp, JSON.stringify(colour));
  renameSync(tmp, file());
}

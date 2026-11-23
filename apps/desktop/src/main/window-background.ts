import { app, nativeTheme } from "electron";
import { readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import type { WindowBackground } from "../ipc-contract";

const RGB = /^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/;

const file = () => join(app.getPath("userData"), "window-background.json");

export function isWindowBackground(value: unknown): value is WindowBackground {
  if (typeof value !== "object" || value === null) return false;
  const { light, dark } = value as Record<string, unknown>;
  return (
    typeof light === "string" &&
    typeof dark === "string" &&
    RGB.test(light) &&
    RGB.test(dark)
  );
}

export function pickWindowBackground(background: WindowBackground): string {
  return nativeTheme.shouldUseDarkColors ? background.dark : background.light;
}

// The renderer paints the theme's background only once it loads, so the
// window opens on the colours it last reported to avoid a flash of another one.
export function getWindowBackground(): string {
  const stored = readStored();
  if (stored) return pickWindowBackground(stored);
  return nativeTheme.shouldUseDarkColors ? "#141417" : "#ffffff";
}

function readStored(): WindowBackground | null {
  try {
    const stored: unknown = JSON.parse(readFileSync(file(), "utf8"));
    return isWindowBackground(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function setWindowBackground(background: WindowBackground): void {
  const tmp = file() + ".tmp";
  try {
    writeFileSync(tmp, JSON.stringify(background));
    renameSync(tmp, file());
  } catch (error) {
    console.error("[uxie] could not save the window background", error);
  }
}

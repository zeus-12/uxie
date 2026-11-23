import { randomUUID } from "crypto";
import { rename, rm, stat, writeFile } from "fs/promises";
import { basename, dirname, join } from "path";
import { BrowserWindow, dialog } from "electron";

export async function writeAtomically(
  destinationPath: string,
  contents: Uint8Array | string,
): Promise<void> {
  const temporaryPath = join(
    dirname(destinationPath),
    `.${basename(destinationPath)}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, contents);
    await rename(temporaryPath, destinationPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function chooseExportPath(
  options: Electron.SaveDialogOptions,
): Promise<string | null> {
  const window = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options);
  return canceled || !filePath ? null : filePath;
}

async function directoryId(path: string): Promise<string | null> {
  try {
    const { dev, ino } = await stat(path);
    return `${dev}:${ino}`;
  } catch {
    return null;
  }
}

export async function assertOutsideLibrary(
  destinationPath: string,
  libraryRoot: string,
): Promise<void> {
  const library = await directoryId(libraryRoot);
  if (library === null) return;
  let dir = dirname(destinationPath);
  while ((await directoryId(dir)) !== library) {
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
  throw new Error(
    "Choose a folder outside Uxie's library so the stored PDFs stay unchanged.",
  );
}

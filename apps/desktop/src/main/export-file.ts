import { randomUUID } from "crypto";
import { rename, rm, writeFile } from "fs/promises";
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

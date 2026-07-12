import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import { join } from "path";
import type { IpcInvokeContract } from "../ipc-contract";

let mainWindow: BrowserWindow | null = null;

const isMac = process.platform === "darwin";

// ── IPC ──────────────────────────────────────────────────────────────
// One handler per invoke channel. Typing the table as the mapped contract
// makes a missing/extra/mistyped handler a compile error — the contract and
// main can't drift.
const invokeHandlers: {
  [K in keyof IpcInvokeContract]: (
    ...args: IpcInvokeContract[K]["args"]
  ) => Promise<IpcInvokeContract[K]["result"]> | IpcInvokeContract[K]["result"];
} = {
  "app:info": () => ({
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
  }),
};

function registerIpc() {
  for (const [channel, handler] of Object.entries(invokeHandlers)) {
    ipcMain.handle(channel, (_event, ...args) =>
      (handler as (...a: unknown[]) => unknown)(...args),
    );
  }
}

// ── Window ───────────────────────────────────────────────────────────
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#09090b" : "#fafafa",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // External links open in the user's real browser, not a blank Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  return win;
}

app.whenReady().then(() => {
  registerIpc();
  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});

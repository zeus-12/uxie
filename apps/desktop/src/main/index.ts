import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  protocol,
  shell,
} from "electron";
import { join } from "path";
import type { IpcInvokeContract } from "../ipc-contract";
import {
  addHighlight,
  createDocument,
  deleteHighlight,
  getDb,
  getDocument,
  initDatabase,
  listDocuments,
  updateAreaHighlight,
  updateDocumentNotes,
  updateDocumentTitle,
  updateLastReadPage,
} from "./db";
import {
  deleteDocumentWithFile,
  importPdf,
  PDF_PRIVILEGE,
  registerPdfProtocol,
} from "./pdf";

protocol.registerSchemesAsPrivileged([PDF_PRIVILEGE]);

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

  "documents:import": () => importPdf(),
  "documents:list": () => listDocuments(getDb()),
  "documents:get": (id) => getDocument(getDb(), id),
  "documents:create": (input) => createDocument(getDb(), input),
  "documents:updateNotes": (id, note) =>
    updateDocumentNotes(getDb(), id, note),
  "documents:updateLastReadPage": (id, page) =>
    updateLastReadPage(getDb(), id, page),
  "documents:updateTitle": (id, title) =>
    updateDocumentTitle(getDb(), id, title),
  "documents:delete": (id) => deleteDocumentWithFile(id),

  "highlights:add": (input) => addHighlight(getDb(), input),
  "highlights:delete": (id) => deleteHighlight(getDb(), id),
  "highlights:updateArea": (id, boundingRect) =>
    updateAreaHighlight(getDb(), id, boundingRect),
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
  initDatabase();
  registerPdfProtocol();
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

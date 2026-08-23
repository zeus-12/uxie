import { app, BrowserWindow, ipcMain, protocol, shell } from "electron";
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
  updateReaderState,
} from "./db";
import {
  deleteDocumentWithFile,
  importPdf,
  migrateDocumentStorage,
  PDF_PRIVILEGE,
  registerPdfProtocol,
  setDocumentCover,
  storeDocumentImage,
} from "./pdf";
import { getSettings, setSettings } from "./settings";
import { cancelCompletion, streamCompletion } from "./ai/completion";
import { cancelChat, resolveChatRetrieve, streamChat } from "./ai/chat";
import { getFlashcardsByDocId } from "./db/flashcards";
import { evaluateFlashcard, generateFlashcardsForDoc } from "./ai/flashcards";
import { extractPdfText } from "./pdf-text";
import { queryEmbeddings, storeEmbeddings } from "./embeddings";
import { createMessage, getMessagesByDocId } from "./db/messages";

// Without this, app.getName() falls back to package.json's "name" — the
// workspace's "@uxie/desktop" — and userData lands in a nested "@uxie/desktop"
// folder. Packaged builds already resolve to "Uxie" via electron-builder's
// productName, so setting it here is what makes dev and packaged agree on one
// directory. Must run before anything resolves app.getPath("userData").
app.setName("Uxie");

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
  "documents:updateReaderState": (id, state) =>
    updateReaderState(getDb(), id, state),
  "documents:updateTitle": (id, title) =>
    updateDocumentTitle(getDb(), id, title),
  "documents:setCover": (id, png) => setDocumentCover(id, png),
  "documents:delete": (id) => deleteDocumentWithFile(id),
  "documents:storeImage": (docId, png) => storeDocumentImage(docId, png),

  "highlights:add": (input) => addHighlight(getDb(), input),
  // Deliberately leaves the screenshot on disk: the same image is embedded in
  // the user's notes, and deleting the annotation shouldn't blank out something
  // they wrote around. Files are still bounded — the document's folder takes
  // them all when it goes.
  "highlights:delete": (id) => deleteHighlight(getDb(), id),
  "highlights:updateArea": (id, boundingRect) =>
    updateAreaHighlight(getDb(), id, boundingRect),

  "settings:get": () => getSettings(),
  "settings:set": (settings) => setSettings(settings),

  "flashcards:getByDocId": (docId) => getFlashcardsByDocId(getDb(), docId),
  "flashcards:generate": (docId) => generateFlashcardsForDoc(docId),

  "messages:getByDocId": (docId) => getMessagesByDocId(getDb(), docId),
  "messages:create": (docId, role, parts) =>
    createMessage(getDb(), docId, role, parts),

  "documents:getText": (docId) => extractPdfText(docId),
  "embeddings:store": (docId, items) => storeEmbeddings(docId, items),
  "embeddings:query": (docId, embedding, k) =>
    queryEmbeddings(docId, embedding, k),
};

function registerIpc() {
  for (const [channel, handler] of Object.entries(invokeHandlers)) {
    ipcMain.handle(channel, (_event, ...args) =>
      (handler as (...a: unknown[]) => unknown)(...args),
    );
  }

  ipcMain.on("completion:start", (event, streamId, prompt) => {
    void streamCompletion(event.sender, streamId, prompt);
  });
  ipcMain.on("completion:cancel", (_event, streamId) =>
    cancelCompletion(streamId),
  );
  ipcMain.on("flashcard:evaluate", (event, streamId, input) => {
    void evaluateFlashcard(event.sender, streamId, input);
  });
  ipcMain.on("chat:start", (event, streamId, docId, messages) => {
    void streamChat(event.sender, streamId, docId, messages);
  });
  ipcMain.on("chat:cancel", (_event, streamId) => cancelChat(streamId));
  ipcMain.on("chat:retrieve:reply", (_event, reqId, chunks) =>
    resolveChatRetrieve(reqId, chunks),
  );
}

// ── Window ───────────────────────────────────────────────────────────
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: "#ffffff",
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

app.whenReady().then(async () => {
  initDatabase();
  // Before anything can serve a file: older installs keep the pdf and cover in
  // a flat layout, and every path helper now assumes per-document folders.
  await migrateDocumentStorage();
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

/**
 * The IPC contract between main and the renderer — the single source of truth
 * for every channel's name, argument tuple, and result type.
 *
 * Everything else derives from this file, so the layers cannot drift:
 *   - main/index.ts implements a handler table typed
 *     `{ [K in keyof IpcInvokeContract]: … }` — a missing/extra/mistyped
 *     handler is a compile error.
 *   - preload/index.ts builds `window.uxieAPI` mechanically from the API_* maps.
 *   - The renderer's `UxieAPI` type is the mapped type at the bottom of this file.
 *
 * Adding an endpoint = one entry in the matching contract interface + one entry
 * in the matching API_* map + one handler in main's table.
 *
 * Only type-erasable imports plus the API_* name maps live here — no Electron
 * or Node imports — so the renderer program can safely include this file.
 *
 * AI streaming channels land in a later phase of the desktop migration.
 */

import type {
  AddHighlightInput,
  CreateDocumentInput,
  Document,
  DocumentWithHighlights,
  RectInput,
} from "@uxie/shared/schema";

/** Basic host facts, fetched over a real IPC round-trip to prove the bridge. */
export interface AppInfo {
  appVersion: string;
  electronVersion: string;
  platform: NodeJS.Platform;
}

/** Request/response channels: `ipcRenderer.invoke` ↔ `ipcMain.handle`. */
export interface IpcInvokeContract {
  "app:info": { args: []; result: AppInfo };

  // Documents
  "documents:import": { args: []; result: Document | null };
  "documents:list": { args: []; result: Document[] };
  "documents:get": {
    args: [id: string];
    result: DocumentWithHighlights | null;
  };
  "documents:create": { args: [input: CreateDocumentInput]; result: Document };
  "documents:updateNotes": { args: [id: string, note: string]; result: void };
  "documents:updateLastReadPage": {
    args: [id: string, lastReadPage: number];
    result: void;
  };
  "documents:updateTitle": {
    args: [id: string, title: string];
    result: void;
  };
  "documents:delete": { args: [id: string]; result: void };

  // Highlights
  "highlights:add": { args: [input: AddHighlightInput]; result: void };
  "highlights:delete": { args: [id: string]; result: void };
  "highlights:updateArea": {
    args: [id: string, boundingRect: RectInput];
    result: void;
  };
}

/** Fire-and-forget renderer→main channels: `ipcRenderer.send` ↔ `ipcMain.on`. */
export interface IpcSendContract {
  // (none yet)
}

/** Main→renderer push channels: `webContents.send` ↔ `ipcRenderer.on`. */
export interface IpcEventContract {
  // (none yet)
}

// ── window.uxieAPI surface ───────────────────────────────────────────
// Method name → channel. preload builds the real object from these maps, and
// the UxieAPI type below is derived from them — so a method can't exist without
// a channel, point at an unknown channel, or disagree on types.

export const API_INVOKE = {
  getAppInfo: "app:info",

  importDocument: "documents:import",
  listDocuments: "documents:list",
  getDocument: "documents:get",
  createDocument: "documents:create",
  updateDocumentNotes: "documents:updateNotes",
  updateLastReadPage: "documents:updateLastReadPage",
  updateDocumentTitle: "documents:updateTitle",
  deleteDocument: "documents:delete",

  addHighlight: "highlights:add",
  deleteHighlight: "highlights:delete",
  updateAreaHighlight: "highlights:updateArea",
} as const satisfies Record<string, keyof IpcInvokeContract>;

export const API_SEND = {} as const satisfies Record<
  string,
  keyof IpcSendContract
>;

export const API_EVENTS = {} as const satisfies Record<
  string,
  keyof IpcEventContract
>;

/** The renderer-facing API, derived method-by-method from the maps above.
 *  Event subscriptions return an unsubscribe function. */
export type UxieAPI = {
  [M in keyof typeof API_INVOKE]: (
    ...args: IpcInvokeContract[(typeof API_INVOKE)[M]]["args"]
  ) => Promise<IpcInvokeContract[(typeof API_INVOKE)[M]]["result"]>;
} & {
  [M in keyof typeof API_SEND]: (
    ...args: IpcSendContract[(typeof API_SEND)[M]]
  ) => void;
} & {
  [M in keyof typeof API_EVENTS]: (
    cb: (...args: IpcEventContract[(typeof API_EVENTS)[M]]) => void,
  ) => () => void;
};

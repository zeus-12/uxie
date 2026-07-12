import { contextBridge, ipcRenderer } from "electron";
import {
  API_INVOKE,
  API_SEND,
  API_EVENTS,
  type UxieAPI,
} from "../ipc-contract";

// The whole bridge is derived from the contract's name→channel maps: every
// method is a pure forward (defaults for optional args live in main's
// handlers). The single cast at the bottom is sound because the maps drive both
// this object's runtime shape and the UxieAPI type.
const api: Record<string, unknown> = {};

// Channels are always strings; the annotations keep the loops sound even while
// a map is still empty (Object.entries would otherwise widen its value to
// `unknown` for an empty map).
const invokeEntries = Object.entries(API_INVOKE) as [string, string][];
const sendEntries = Object.entries(API_SEND) as [string, string][];
const eventEntries = Object.entries(API_EVENTS) as [string, string][];

for (const [method, channel] of invokeEntries) {
  api[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);
}

for (const [method, channel] of sendEntries) {
  api[method] = (...args: unknown[]) => ipcRenderer.send(channel, ...args);
}

for (const [method, channel] of eventEntries) {
  api[method] = (cb: (...args: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      cb(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
}

contextBridge.exposeInMainWorld("uxieAPI", api as UxieAPI);

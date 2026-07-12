import type { UxieAPI } from "../ipc-contract";

declare global {
  interface Window {
    uxieAPI: UxieAPI;
  }
}

export {};

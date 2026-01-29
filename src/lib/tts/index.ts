import {
  BROWSER_VOICES,
  type BrowserVoiceId,
} from "./providers/browser-provider";
import { KOKORO_VOICES, type KokoroVoiceId } from "./providers/kokoro-provider";

export type TTSEngineType = "browser" | "local";
export type TTSVoiceId = BrowserVoiceId | KokoroVoiceId;

export function getEngineFromVoice(voiceId: TTSVoiceId): TTSEngineType {
  if (BROWSER_VOICES.some((v) => v.id === voiceId)) {
    return "browser";
  }

  if (KOKORO_VOICES.some((v) => v.id === voiceId)) {
    return "local";
  }

  return "browser";
}

export async function detectWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return false;
  }
  try {
    // @ts-expect-error navigator.gpu not typed
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

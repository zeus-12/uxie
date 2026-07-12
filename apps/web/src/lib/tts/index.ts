import {
  BROWSER_VOICES,
  type BrowserVoiceId,
} from "./providers/browser-provider";
import { KOKORO_VOICES, type KokoroVoiceId } from "./providers/kokoro-provider";
import {
  SUPERTONIC_VOICES,
  type SupertonicVoiceId,
} from "./providers/supertonic-provider";

export type TTSEngineType = "browser" | "kokoro" | "supertonic";
export type TTSVoiceId = BrowserVoiceId | KokoroVoiceId | SupertonicVoiceId;

export function getEngineFromVoice(voiceId: TTSVoiceId): TTSEngineType {
  if (BROWSER_VOICES.some((v) => v.id === voiceId)) {
    return "browser";
  }

  if (KOKORO_VOICES.some((v) => v.id === voiceId)) {
    return "kokoro";
  }

  if (SUPERTONIC_VOICES.some((v) => v.id === voiceId)) {
    return "supertonic";
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

export const getDeviceType = async (device?: string) => {
  device = device || (await getDevice());
  return device === "wasm" ? "q8" : "fp32";
};

export const getDevice = async () => {
  const device = (await detectWebGPU()) ? "webgpu" : "wasm";
  return device;
};

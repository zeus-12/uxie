import { type GenerateOptions, KokoroTTS, TextSplitterStream } from "kokoro-js";
import { getDevice, getDeviceType } from "..";
import { BaseAudioProvider } from "../base-audio-provider";
import type {
  CachedAudio,
  TTSProviderInfo,
  TTSVoice,
  WordTiming,
} from "../types";
import {
  combineSamples,
  computeChunkWordTimings,
  findChunkPosition,
} from "../utils";

export type KokoroVoiceId = NonNullable<GenerateOptions["voice"]>;

export const KOKORO_VOICES = [
  { id: "af_heart", name: "Heart (Female)", gender: "female" },
  { id: "af_nicole", name: "Nicole (Female)", gender: "female" },
  { id: "am_echo", name: "Echo (Male)", gender: "male" },
  { id: "bm_fable", name: "Fable (Male)", gender: "male" },
] as const satisfies TTSVoice<KokoroVoiceId>[];

const SAMPLE_RATE = 24000;

export class KokoroProvider extends BaseAudioProvider<KokoroVoiceId> {
  private tts: KokoroTTS | null = null;

  readonly info: TTSProviderInfo<KokoroVoiceId> = {
    id: "kokoro",
    name: "Kokoro (Local)",
    supportsStreaming: true,
    supportsOfflineUse: true,
    voices: KOKORO_VOICES,
  };

  constructor() {
    super(KOKORO_VOICES[0].id);
  }

  get isModelLoaded(): boolean {
    return this.tts !== null;
  }

  protected async loadModel(): Promise<void> {
    const isFromCache = await this.isModelCached();
    this.onLoadProgress?.({ status: isFromCache ? "loading" : "downloading" });

    const device = await getDevice();
    const dtype = await getDeviceType();

    this.tts = await KokoroTTS.from_pretrained(
      "onnx-community/Kokoro-82M-v1.0-ONNX",
      {
        dtype,
        device,
        progress_callback: (data) => {
          if (data.status === "progress" && data.progress !== undefined) {
            this.onLoadProgress?.({
              status: isFromCache ? "loading" : "downloading",
              progress: data.progress,
            });
          }
        },
      },
    );

    this.onLoadProgress?.({ status: "ready" });
  }

  protected async isModelCached(): Promise<boolean> {
    if (typeof caches === "undefined") return false;
    try {
      const cache = await caches.open("transformers-cache");
      const keys = await cache.keys();
      return keys.some((req) => req.url.includes("Kokoro"));
    } catch {
      return false;
    }
  }

  protected async generateAudio(text: string): Promise<CachedAudio | null> {
    try {
      await this.init();
      if (!this.tts) return null;

      const splitter = new TextSplitterStream();
      const stream = this.tts.stream(splitter, {
        voice: this.currentVoice as KokoroVoiceId,
        speed: this.currentSpeed,
      });

      splitter.push(text);
      splitter.close();

      const audioContext = this.getAudioContext();
      const allSamples: Float32Array[] = [];
      const wordTimings: WordTiming[] = [];

      let currentTimeMs = 0;
      let searchStartIndex = 0;

      for await (const { text: chunkText, audio } of stream) {
        const samples = audio.audio;
        allSamples.push(samples);

        const chunkDurationMs = (samples.length / SAMPLE_RATE) * 1000;
        const chunkStart = findChunkPosition(text, chunkText, searchStartIndex);

        if (chunkStart !== -1) {
          wordTimings.push(
            ...computeChunkWordTimings(
              chunkText,
              chunkStart,
              currentTimeMs,
              chunkDurationMs,
            ),
          );
          searchStartIndex = chunkStart + chunkText.length;
        }

        currentTimeMs += chunkDurationMs;
      }

      const combined = combineSamples(allSamples);
      const audioBuffer = audioContext.createBuffer(
        1,
        combined.length,
        SAMPLE_RATE,
      );
      audioBuffer.copyToChannel(combined, 0);

      return { audioBuffer, wordTimings };
    } catch (err) {
      console.error("[KokoroProvider] Generation error:", err);
      return null;
    }
  }
}

import { pipeline, TextToAudioPipeline } from "@huggingface/transformers";
import { getDevice, getDeviceType } from "..";
import { BaseAudioProvider } from "../base-audio-provider";
import type {
  CachedAudio,
  TTSProviderInfo,
  TTSVoice,
  WordTiming,
} from "../types";
import {
  chunkText,
  combineSamples,
  computeChunkWordTimings,
  findChunkPosition,
} from "../utils";

export const SUPERTONIC_VOICES = [
  { id: "M3", name: "Robert", gender: "male" },
  { id: "M5", name: "Daniel", gender: "male" },
  { id: "F1", name: "Sarah", gender: "female" },
  { id: "F5", name: "Emily", gender: "female" },
  { id: "F3", name: "Jessica", gender: "female" },
] as const satisfies TTSVoice<string>[];

export type SupertonicVoiceId = (typeof SUPERTONIC_VOICES)[number]["id"];

const SAMPLE_RATE = 44100;
const MODEL_ID = "onnx-community/Supertonic-TTS-2-ONNX";
const SPEAKER_EMBEDDINGS_BASE =
  "https://huggingface.co/onnx-community/Supertonic-TTS-2-ONNX/resolve/main/voices";

export class SupertonicProvider extends BaseAudioProvider<SupertonicVoiceId> {
  private pipeline: TextToAudioPipeline | null = null;

  readonly info: TTSProviderInfo<SupertonicVoiceId> = {
    id: "supertonic",
    name: "Supertonic (Local)",
    supportsStreaming: false,
    supportsOfflineUse: true,
    voices: SUPERTONIC_VOICES,
  };

  constructor() {
    super(SUPERTONIC_VOICES[0].id);
  }

  get isModelLoaded(): boolean {
    return this.pipeline !== null;
  }

  protected async loadModel(): Promise<void> {
    const isFromCache = await this.isModelCached();
    this.onLoadProgress?.({ status: isFromCache ? "loading" : "downloading" });

    const device = await getDevice();
    const dtype = await getDeviceType();

    this.pipeline = await pipeline<"text-to-speech">(
      "text-to-speech",
      MODEL_ID,
      {
        device,
        dtype,
        progress_callback: (data: { status: string; progress?: number }) => {
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
      return keys.some((req) => req.url.includes("Supertonic"));
    } catch {
      return false;
    }
  }

  protected async generateAudio(text: string): Promise<CachedAudio | null> {
    try {
      await this.init();
      if (!this.pipeline) return null;

      const chunks = chunkText(text);
      const audioContext = this.getAudioContext();
      const allSamples: Float32Array[] = [];
      const wordTimings: WordTiming[] = [];

      let currentTimeMs = 0;
      let searchStartIndex = 0;

      const speakerUrl = `${SPEAKER_EMBEDDINGS_BASE}/${this.currentVoice}.bin`;
      const silenceGap = new Float32Array(Math.floor(SAMPLE_RATE * 0.05));

      for (const chunk of chunks) {
        const wrappedChunk = `<en>${chunk}</en>`;

        const output = await this.pipeline(wrappedChunk, {
          speaker_embeddings: speakerUrl,
          num_inference_steps: 5,
          speed: this.currentSpeed,
        });

        const samples: Float32Array = output.audio;
        allSamples.push(samples);

        const chunkDurationMs = (samples.length / SAMPLE_RATE) * 1000;
        const chunkStart = findChunkPosition(text, chunk, searchStartIndex);

        if (chunkStart !== -1) {
          wordTimings.push(
            ...computeChunkWordTimings(
              chunk,
              chunkStart,
              currentTimeMs,
              chunkDurationMs,
            ),
          );
          searchStartIndex = chunkStart + chunk.length;
        }

        currentTimeMs += chunkDurationMs;

        allSamples.push(silenceGap);
        currentTimeMs += (silenceGap.length / SAMPLE_RATE) * 1000;
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
      console.error("[SupertonicProvider] Generation error:", err);
      return null;
    }
  }
}

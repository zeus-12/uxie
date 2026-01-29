import type { GenerateOptions, KokoroTTS } from "kokoro-js";
import { detectWebGPU } from "..";
import type {
  TTSPlaybackState,
  TTSProgress,
  TTSProvider,
  TTSProviderInfo,
  TTSSpeakOptions,
  TTSStatus,
  TTSVoice,
} from "../types";

export type KokoroVoiceId = NonNullable<GenerateOptions["voice"]>;

export const KOKORO_VOICES = [
  { id: "af_heart", name: "Heart (Female)", gender: "female" },
  { id: "af_nicole", name: "Nicole (Female)", gender: "female" },
  { id: "am_echo", name: "Echo (Male)", gender: "male" },
  { id: "bm_fable", name: "Fable (Male)", gender: "male" },
] as const satisfies TTSVoice<KokoroVoiceId>[];

interface CachedAudio {
  audioBuffer: AudioBuffer;
}

export class KokoroProvider implements TTSProvider<KokoroVoiceId> {
  private tts: KokoroTTS | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;

  private _status: TTSStatus = "idle";
  private currentVoice: KokoroVoiceId = KOKORO_VOICES[0].id;
  private currentSpeed = 1;
  private playbackStartTime = 0;
  private pausedAtTime = 0;
  private currentCharIndex = 0;
  private currentSentenceIndex = 0;
  private abortController: AbortController | null = null;
  private loadPromise: Promise<void> | null = null;
  private speakResolver: (() => void) | null = null;

  private cache = new Map<string, CachedAudio>();
  private pendingGenerations = new Map<string, Promise<CachedAudio | null>>();
  private isStopped = false;
  private speakId = 0;

  onWordBoundary?: (charIndex: number, charLength: number) => void;
  onEnd?: () => void;
  onLoadProgress?: (progress: TTSProgress) => void;
  onGenerating?: (isGenerating: boolean) => void;

  readonly info: TTSProviderInfo<KokoroVoiceId> = {
    id: "kokoro",
    name: "Kokoro (Local)",
    supportsStreaming: true,
    supportsOfflineUse: true,
    voices: KOKORO_VOICES,
  };

  get status(): TTSStatus {
    return this._status;
  }

  get isModelLoaded(): boolean {
    return this.tts !== null;
  }

  async init(): Promise<void> {
    if (this.tts) return;
    if (this.loadPromise) {
      await this.loadPromise;
      return;
    }
    this.loadPromise = this.loadModel();
    await this.loadPromise;
  }

  private async loadModel(): Promise<void> {
    const isFromCache = await this.isModelCached();
    this.onLoadProgress?.({ status: isFromCache ? "loading" : "downloading" });

    const device = (await detectWebGPU()) ? "webgpu" : "wasm";

    const { KokoroTTS } = await import("kokoro-js");

    this.tts = await KokoroTTS.from_pretrained(
      "onnx-community/Kokoro-82M-v1.0-ONNX",
      {
        dtype: device === "wasm" ? "q8" : "fp32",
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

  private async isModelCached(): Promise<boolean> {
    if (typeof caches === "undefined") return false;
    try {
      const cache = await caches.open("transformers-cache");
      const keys = await cache.keys();
      return keys.some((req) => req.url.includes("Kokoro"));
    } catch {
      return false;
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  private getCacheKey(text: string): string {
    return `${text}::${this.currentVoice}::${this.currentSpeed}`;
  }

  async pregenerate(text: string): Promise<void> {
    const key = this.getCacheKey(text);

    if (this.cache.has(key) || this.pendingGenerations.has(key)) {
      return;
    }

    const promise = this.generateAudio(text);
    this.pendingGenerations.set(key, promise);

    try {
      const result = await promise;
      if (result) {
        this.cache.set(key, result);
        this.pruneCache();
      }
    } finally {
      this.pendingGenerations.delete(key);
    }
  }

  private async generateAudio(text: string): Promise<CachedAudio | null> {
    try {
      await this.init();
      if (!this.tts) return null;

      const audio = await this.tts.generate(text, {
        voice: this.currentVoice,
        speed: this.currentSpeed,
      });

      const wavBuffer = audio.toWav();
      const audioContext = this.getAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(wavBuffer);

      return { audioBuffer };
    } catch (err) {
      console.error("[KokoroProvider] Generation error:", err);
      return null;
    }
  }

  private pruneCache(): void {
    const maxSize = 3;
    while (this.cache.size > maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  async speak(text: string, options: TTSSpeakOptions): Promise<void> {
    this.stopCurrentAudio();
    this.abortController?.abort();

    const thisSpeakId = ++this.speakId;

    this.isStopped = false;
    this.currentSpeed = options.speed;
    if (options.voice) {
      this.currentVoice = options.voice as KokoroVoiceId;
    }
    this.currentCharIndex = options.startCharIndex ?? 0;
    this.abortController = new AbortController();
    this.setStatus("loading");

    try {
      await this.init();
      if (!this.tts || thisSpeakId !== this.speakId) {
        if (thisSpeakId === this.speakId) this.setStatus("idle");
        return;
      }

      const key = this.getCacheKey(text);
      let cached = this.cache.get(key);

      if (!cached && this.pendingGenerations.has(key)) {
        cached = (await this.pendingGenerations.get(key)) ?? undefined;
      }

      // Check again after potential await
      if (thisSpeakId !== this.speakId) {
        return;
      }

      if (cached) {
        this.cache.delete(key);
        await this.playAudioBuffer(cached.audioBuffer, thisSpeakId);
        return;
      }

      this.onGenerating?.(true);
      const result = await this.generateAudio(text);
      this.onGenerating?.(false);

      if (!result || thisSpeakId !== this.speakId) {
        if (thisSpeakId === this.speakId) this.setStatus("idle");
        return;
      }

      await this.playAudioBuffer(result.audioBuffer, thisSpeakId);
    } catch (err) {
      this.onGenerating?.(false);
      if ((err as Error).name !== "AbortError") {
        console.error("[KokoroProvider] Error:", err);
      }
      if (thisSpeakId === this.speakId) this.setStatus("idle");
    }
  }

  private async playAudioBuffer(
    audioBuffer: AudioBuffer,
    thisSpeakId: number,
  ): Promise<void> {
    // Final check before playing - ensure we're still the active speak
    if (thisSpeakId !== this.speakId) {
      return;
    }

    // Stop any existing audio before playing new one
    this.stopCurrentAudio();

    const audioContext = this.getAudioContext();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    // Check again after potential await
    if (thisSpeakId !== this.speakId) {
      return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    this.sourceNode = source;
    this.playbackStartTime = audioContext.currentTime;
    this.pausedAtTime = 0;

    this.setStatus("speaking");
    this.startHighlightLoop();

    return new Promise<void>((resolve) => {
      this.speakResolver = resolve;

      source.onended = () => {
        this.speakResolver = null;
        this.stopHighlightLoop();
        // Only fire onEnd if this is still the active speak and not stopped
        if (this.isStopped || thisSpeakId !== this.speakId) {
          resolve();
          return;
        }
        if (this._status === "speaking") {
          this.setStatus("idle");
          this.onEnd?.();
        }
        resolve();
      };

      source.start(0);
    });
  }

  private setStatus(status: TTSStatus): void {
    this._status = status;
  }

  private startHighlightLoop(): void {}

  private stopHighlightLoop(): void {}

  private stopCurrentAudio(): void {
    this.speakResolver?.();
    this.speakResolver = null;

    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
      } catch {}
      this.sourceNode = null;
    }
    this.stopHighlightLoop();
  }

  pause(): void {
    if (this._status !== "speaking") return;

    if (this.audioContext && this.sourceNode) {
      this.pausedAtTime =
        (this.audioContext.currentTime - this.playbackStartTime) * 1000;
      this.stopCurrentAudio();
    }

    this.setStatus("paused");
  }

  async resume(): Promise<void> {
    if (this._status !== "paused") return;
    this.setStatus("idle");
    this.onEnd?.();
  }

  stop(): void {
    this.speakId++; // Invalidate any pending operations
    this.isStopped = true;
    this.abortController?.abort();
    this.stopCurrentAudio();
    this.pausedAtTime = 0;
    this.setStatus("idle");
  }

  cancel(): void {
    this.speakId++; // Invalidate any pending operations
    this.isStopped = true;
    this.abortController?.abort();
    this.stopCurrentAudio();
    this.setStatus("idle");
  }

  setSpeed(speed: number): void {
    this.currentSpeed = speed;
  }

  setVoice(voiceId: string): void {
    this.currentVoice = voiceId as KokoroVoiceId;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getPlaybackState(): TTSPlaybackState {
    return {
      sentenceIndex: this.currentSentenceIndex,
      charIndex: this.currentCharIndex,
      isPlaying: this._status === "speaking",
    };
  }
}

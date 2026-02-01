import { type GenerateOptions, KokoroTTS, TextSplitterStream } from "kokoro-js";
import { detectWebGPU } from "..";
import type {
  TTSPlaybackState,
  TTSProgress,
  TTSProvider,
  TTSProviderInfo,
  TTSSpeakOptions,
  TTSStatus,
  TTSVoice,
  WordTiming,
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
  wordTimings: WordTiming[];
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
  private currentTextKey: string | null = null;
  private currentText: string | null = null;

  private wordTimings: WordTiming[] = [];
  private highlightLoopId: number | null = null;
  private currentWordIndex = -1;
  private playbackOffset = 0;

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

  private findCurrentWordIndex(
    timings: WordTiming[],
    elapsedMs: number,
  ): number {
    for (let i = 0; i < timings.length; i++) {
      const timing = timings[i]!;
      if (elapsedMs >= timing.startTime && elapsedMs < timing.endTime) {
        return i;
      }
    }

    if (timings.length > 0) {
      const lastTiming = timings[timings.length - 1]!;
      if (elapsedMs >= lastTiming.endTime) {
        return timings.length - 1;
      }
    }

    return -1;
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

      const splitter = new TextSplitterStream();
      const stream = this.tts.stream(splitter, {
        voice: this.currentVoice,
        speed: this.currentSpeed,
      });

      splitter.push(text);
      splitter.close();

      const audioContext = this.getAudioContext();
      const sampleRate = 24000;
      const allSamples: Float32Array[] = [];
      const wordTimings: WordTiming[] = [];

      let currentTimeMs = 0;
      let searchStartIndex = 0;

      for await (const { text: chunkText, audio } of stream) {
        const samples = audio.audio;
        allSamples.push(samples);

        const chunkDurationMs = (samples.length / sampleRate) * 1000;

        const chunkStartInOriginal = this.findChunkPosition(
          text,
          chunkText,
          searchStartIndex,
        );

        if (chunkStartInOriginal !== -1) {
          const chunkTimings = this.computeChunkWordTimings(
            chunkText,
            chunkStartInOriginal,
            currentTimeMs,
            chunkDurationMs,
          );

          wordTimings.push(...chunkTimings);
          searchStartIndex = chunkStartInOriginal + chunkText.length;
        }

        currentTimeMs += chunkDurationMs;
      }

      const totalLength = allSamples.reduce((sum, arr) => sum + arr.length, 0);
      const combinedSamples = new Float32Array(totalLength);
      let offset = 0;
      for (const samples of allSamples) {
        combinedSamples.set(samples, offset);
        offset += samples.length;
      }

      const audioBuffer = audioContext.createBuffer(
        1,
        combinedSamples.length,
        sampleRate,
      );
      audioBuffer.copyToChannel(combinedSamples, 0);

      return { audioBuffer, wordTimings };
    } catch (err) {
      console.error("[KokoroProvider] Generation error:", err);
      return null;
    }
  }

  private findChunkPosition(
    fullText: string,
    chunkText: string,
    searchStart: number,
  ): number {
    const trimmedChunk = chunkText.trim();
    const index = fullText.indexOf(trimmedChunk, searchStart);
    if (index !== -1) return index;
    const words = trimmedChunk.split(/\s+/);
    if (words.length > 0 && words[0]) {
      return fullText.indexOf(words[0], searchStart);
    }
    return searchStart;
  }

  private computeChunkWordTimings(
    chunkText: string,
    chunkOffset: number,
    chunkStartTimeMs: number,
    chunkDurationMs: number,
  ): WordTiming[] {
    const words: { word: string; localIndex: number; charLength: number }[] =
      [];
    const wordRegex = /\S+/g;
    let match: RegExpExecArray | null;

    while ((match = wordRegex.exec(chunkText)) !== null) {
      words.push({
        word: match[0],
        localIndex: match.index,
        charLength: match[0].length,
      });
    }

    if (words.length === 0) return [];

    const totalChars = words.reduce((sum, w) => sum + w.charLength, 0);
    const timings: WordTiming[] = [];
    let currentTime = chunkStartTimeMs;

    for (const wordInfo of words) {
      const charRatio = wordInfo.charLength / Math.max(totalChars, 1);
      const wordDuration = chunkDurationMs * charRatio;

      timings.push({
        word: wordInfo.word,
        charIndex: chunkOffset + wordInfo.localIndex,
        charLength: wordInfo.charLength,
        startTime: currentTime,
        endTime: currentTime + wordDuration,
      });

      currentTime += wordDuration;
    }

    return timings;
  }

  private pruneCache(): void {
    const maxSize = 5;
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

    const key = this.getCacheKey(text);

    try {
      await this.init();
      if (!this.tts || thisSpeakId !== this.speakId) {
        if (thisSpeakId === this.speakId) this.setStatus("idle");
        return;
      }

      let cached = this.cache.get(key);

      if (!cached && this.pendingGenerations.has(key)) {
        cached = (await this.pendingGenerations.get(key)) ?? undefined;
      }

      if (thisSpeakId !== this.speakId) {
        return;
      }

      if (cached) {
        this.currentTextKey = key;
        this.currentText = text;
        this.wordTimings = cached.wordTimings;
        await this.playAudioBuffer(cached.audioBuffer, thisSpeakId);
        return;
      }

      this.onGenerating?.(true);
      const result = await this.generateAudio(text);
      this.onGenerating?.(false);

      if (result) {
        this.cache.set(key, result);
        this.pruneCache();
      }

      if (!result || thisSpeakId !== this.speakId) {
        if (thisSpeakId === this.speakId) this.setStatus("idle");
        return;
      }

      this.currentTextKey = key;
      this.currentText = text;
      this.wordTimings = result.wordTimings;
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
    offsetSeconds: number = 0,
  ): Promise<void> {
    if (thisSpeakId !== this.speakId) {
      return;
    }

    this.stopCurrentAudio();

    const audioContext = this.getAudioContext();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (thisSpeakId !== this.speakId) {
      return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    this.sourceNode = source;
    this.playbackStartTime = audioContext.currentTime;
    this.playbackOffset = offsetSeconds * 1000;
    this.pausedAtTime = 0;

    this.setStatus("speaking");
    this.startHighlightLoop();

    return new Promise<void>((resolve) => {
      this.speakResolver = resolve;

      source.onended = () => {
        this.speakResolver = null;
        this.stopHighlightLoop();

        // Only fire onEnd if this is still the active speak, not stopped, and not paused
        if (
          this.isStopped ||
          thisSpeakId !== this.speakId ||
          this._status === "paused"
        ) {
          resolve();
          return;
        }

        if (this._status === "speaking") {
          this.setStatus("idle");
          this.onEnd?.();
        }
        resolve();
      };

      source.start(0, offsetSeconds);
    });
  }

  private setStatus(status: TTSStatus): void {
    this._status = status;
  }

  private startHighlightLoop(): void {
    this.currentWordIndex = -1;
    let logCounter = 0;

    const loop = () => {
      if (this._status !== "speaking" || !this.audioContext) {
        return;
      }

      const elapsedMs =
        (this.audioContext.currentTime - this.playbackStartTime) * 1000 +
        this.playbackOffset;

      const wordIndex = this.findCurrentWordIndex(this.wordTimings, elapsedMs);

      if (wordIndex !== -1 && wordIndex !== this.currentWordIndex) {
        this.currentWordIndex = wordIndex;
        const timing = this.wordTimings[wordIndex];
        if (timing) {
          this.onWordBoundary?.(timing.charIndex, timing.charLength);
        }
      }

      this.highlightLoopId = requestAnimationFrame(loop);
    };

    this.highlightLoopId = requestAnimationFrame(loop);
  }

  private stopHighlightLoop(): void {
    if (this.highlightLoopId !== null) {
      cancelAnimationFrame(this.highlightLoopId);
      this.highlightLoopId = null;
    }
    this.currentWordIndex = -1;
  }

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
    if (this._status !== "speaking" && this._status !== "loading") return;

    this.speakId++;

    if (this.audioContext && this.sourceNode) {
      this.pausedAtTime =
        (this.audioContext.currentTime - this.playbackStartTime) * 1000 +
        this.playbackOffset;
      this.stopCurrentAudio();
    }

    this.setStatus("paused");
  }

  async resume(): Promise<void> {
    if (this._status !== "paused") return;

    // Try to resume from the paused position using cached audio
    if (this.currentTextKey && this.pausedAtTime > 0) {
      const cached = this.cache.get(this.currentTextKey);
      if (cached) {
        const thisSpeakId = ++this.speakId;
        this.isStopped = false;
        const offsetSeconds = this.pausedAtTime / 1000;
        await this.playAudioBuffer(
          cached.audioBuffer,
          thisSpeakId,
          offsetSeconds,
        );
        return;
      }
    }

    this.setStatus("idle");
  }

  get canResumeFromPosition(): boolean {
    return (
      this._status === "paused" &&
      this.currentTextKey !== null &&
      this.pausedAtTime > 0 &&
      this.cache.has(this.currentTextKey)
    );
  }

  stop(): void {
    this.speakId++;
    this.isStopped = true;
    this.abortController?.abort();
    this.stopCurrentAudio();
    this.pausedAtTime = 0;
    this.playbackOffset = 0;
    this.currentTextKey = null;
    this.currentText = null;
    this.wordTimings = [];
    this.setStatus("idle");
  }

  cancel(): void {
    this.speakId++;
    this.isStopped = true;
    this.abortController?.abort();
    this.stopCurrentAudio();
    this.currentTextKey = null;
    this.currentText = null;
    this.wordTimings = [];
    this.playbackOffset = 0;
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

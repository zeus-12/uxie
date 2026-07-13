import type {
  CachedAudio,
  TTSPlaybackState,
  TTSProgress,
  TTSProvider,
  TTSProviderInfo,
  TTSSpeakOptions,
  TTSStatus,
  WordTiming,
} from "./types";
import { findCurrentWordIndex } from "./utils";

export abstract class BaseAudioProvider<T extends string>
  implements TTSProvider<T>
{
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private _status: TTSStatus = "idle";
  protected currentVoice: string;
  protected currentSpeed = 1;
  private playbackStartTime = 0;
  private pausedAtTime = 0;
  private currentCharIndex = 0;
  private currentSentenceIndex = 0;
  protected loadPromise: Promise<void> | null = null;
  private speakResolver: (() => void) | null = null;

  private cache = new Map<string, CachedAudio>();
  protected pendingGenerations = new Map<string, Promise<CachedAudio | null>>();
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

  abstract readonly info: TTSProviderInfo<T>;
  abstract get isModelLoaded(): boolean;

  protected abstract loadModel(): Promise<void>;
  protected abstract isModelCached(): Promise<boolean>;
  protected abstract generateAudio(text: string): Promise<CachedAudio | null>;

  constructor(defaultVoice: string) {
    this.currentVoice = defaultVoice;
  }

  get status(): TTSStatus {
    return this._status;
  }

  async init(): Promise<void> {
    if (this.isModelLoaded) return;
    if (this.loadPromise) {
      await this.loadPromise;
      return;
    }
    this.loadPromise = this.loadModel();
    await this.loadPromise;
  }

  protected getAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  private getCacheKey(text: string): string {
    return `${text}::${this.currentVoice}::${this.currentSpeed}`;
  }

  private pruneCache(): void {
    const maxSize = 5;
    while (this.cache.size > maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  async pregenerate(text: string): Promise<void> {
    const key = this.getCacheKey(text);
    if (this.cache.has(key) || this.pendingGenerations.has(key)) return;

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

  async speak(text: string, options: TTSSpeakOptions): Promise<void> {
    this.stopCurrentAudio();

    const thisSpeakId = ++this.speakId;

    this.isStopped = false;
    this.currentSpeed = options.speed;
    if (options.voice) {
      this.currentVoice = options.voice;
    }
    this.currentCharIndex = options.startCharIndex ?? 0;
    this.setStatus("loading");

    const key = this.getCacheKey(text);

    try {
      await this.init();
      if (!this.isModelLoaded || thisSpeakId !== this.speakId) {
        if (thisSpeakId === this.speakId) this.setStatus("idle");
        return;
      }

      let cached = this.cache.get(key);

      if (!cached && this.pendingGenerations.has(key)) {
        cached = (await this.pendingGenerations.get(key)) ?? undefined;
      }

      if (thisSpeakId !== this.speakId) return;

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
        console.error(`[${this.info.id}] Error:`, err);
      }
      if (thisSpeakId === this.speakId) this.setStatus("idle");
    }
  }

  private async playAudioBuffer(
    audioBuffer: AudioBuffer,
    thisSpeakId: number,
    offsetSeconds: number = 0,
  ): Promise<void> {
    if (thisSpeakId !== this.speakId) return;

    this.stopCurrentAudio();

    const audioContext = this.getAudioContext();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (thisSpeakId !== this.speakId) return;

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

  protected setStatus(status: TTSStatus): void {
    this._status = status;
  }

  private startHighlightLoop(): void {
    this.currentWordIndex = -1;

    const loop = () => {
      if (this._status !== "speaking" || !this.audioContext) return;

      const elapsedMs =
        (this.audioContext.currentTime - this.playbackStartTime) * 1000 +
        this.playbackOffset;

      const wordIndex = findCurrentWordIndex(this.wordTimings, elapsedMs);

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
    this.currentVoice = voiceId;
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

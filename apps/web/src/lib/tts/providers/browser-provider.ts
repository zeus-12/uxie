import type {
  TTSPlaybackState,
  TTSProgress,
  TTSProvider,
  TTSProviderInfo,
  TTSSpeakOptions,
  TTSStatus,
  TTSVoice,
} from "../types";
import { chunkText, findChunkPosition } from "../utils";

export const BROWSER_VOICES = [
  { id: "Aaron", name: "Aaron", gender: "male" },
] as const;

export type BrowserVoiceId = (typeof BROWSER_VOICES)[number]["id"];

export class BrowserTTSProvider implements TTSProvider<BrowserVoiceId> {
  private utterance: SpeechSynthesisUtterance | null = null;
  private _status: TTSStatus = "idle";
  private currentSpeed = 1;
  private currentVoice: string | null = null;
  private currentCharIndex = 0;
  private currentSentenceIndex = 0;
  private isStopped = false;
  private voices:
    | TTSVoice<BrowserVoiceId>[]
    | readonly TTSVoice<BrowserVoiceId>[] = BROWSER_VOICES;

  onWordBoundary?: (charIndex: number, charLength: number) => void;
  onEnd?: () => void;
  onLoadProgress?: (progress: TTSProgress) => void;

  readonly info: TTSProviderInfo<BrowserVoiceId> = {
    id: "browser",
    name: "Browser (System)",
    supportsStreaming: false,
    supportsOfflineUse: false,
    voices: this.voices,
  };

  get status(): TTSStatus {
    return this._status;
  }

  private setStatus(status: TTSStatus) {
    this._status = status;
  }

  async init(): Promise<void> {
    if (!("speechSynthesis" in window)) {
      throw new Error("Speech synthesis not supported");
    }

    this.onLoadProgress?.({ status: "ready" });
  }

  async speak(text: string, options: TTSSpeakOptions): Promise<void> {
    if (this._status === "speaking") {
      this.stop();
    }

    this.isStopped = false;
    this.currentSpeed = options.speed;
    if (options.voice) {
      this.currentVoice = options.voice;
    }
    this.currentCharIndex = options.startCharIndex ?? 0;

    const chunks = chunkText(text);
    let searchStart = 0;

    this.setStatus("speaking");

    for (const chunk of chunks) {
      if (this.isStopped) return;

      const chunkOffset = findChunkPosition(text, chunk, searchStart);
      searchStart = chunkOffset + chunk.length;

      await this.speakChunk(chunk, chunkOffset, text);

      if (this.isStopped) return;
    }

    if (!this.isStopped) {
      this.setStatus("idle");
      this.utterance = null;
      this.onEnd?.();
    }
  }

  private speakChunk(
    chunk: string,
    charOffset: number,
    fullText: string,
  ): Promise<void> {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = this.currentSpeed;

    if (this.currentVoice) {
      const voices = speechSynthesis.getVoices();
      const voice = voices.find((v) => v.voiceURI === this.currentVoice);
      if (voice) {
        utterance.voice = voice;
      }
    }

    this.utterance = utterance;

    return new Promise<void>((resolve) => {
      utterance.onboundary = (event) => {
        if (event.name === "word") {
          const absoluteIndex = charOffset + event.charIndex;
          this.currentCharIndex = absoluteIndex;
          this.onWordBoundary?.(absoluteIndex, event.charLength);
        }
      };

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = (event) => {
        if (event.error !== "canceled" && event.error !== "interrupted") {
          console.error("[BrowserTTS] Error:", event.error);
        }
        resolve();
      };

      speechSynthesis.speak(utterance);
    });
  }

  pause(): void {
    if (this._status !== "speaking") return;
    speechSynthesis.pause();
    this.setStatus("paused");
  }

  async resume(): Promise<void> {
    if (this._status !== "paused") return;
    speechSynthesis.resume();
    this.setStatus("speaking");
  }

  stop(): void {
    this.isStopped = true;
    speechSynthesis.cancel();
    this.utterance = null;
    this.setStatus("idle");
  }

  cancel(): void {
    this.stop();
  }

  setSpeed(speed: number): void {
    this.currentSpeed = speed;
  }

  setVoice(voiceId: string): void {
    this.currentVoice = voiceId;
  }

  getPlaybackState(): TTSPlaybackState {
    return {
      sentenceIndex: this.currentSentenceIndex,
      charIndex: this.currentCharIndex,
      isPlaying: this._status === "speaking",
    };
  }
}

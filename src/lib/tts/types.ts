export type TTSStatus = "idle" | "speaking" | "paused" | "loading";

export interface TTSVoice<T extends string> {
  id: T;
  name: string;
  gender: "male" | "female";
}

export interface TTSProviderInfo<T extends string> {
  id: string;
  name: string;
  supportsStreaming: boolean;
  supportsOfflineUse: boolean;
  voices: TTSVoice<T>[] | readonly TTSVoice<T>[];
}

export interface TTSPlaybackState {
  sentenceIndex: number;
  charIndex: number;
  isPlaying: boolean;
}

export interface TTSSpeakOptions {
  speed: number;
  voice?: string;
  startCharIndex?: number;
  onCancel?: () => void;
}

export interface TTSProvider<T extends string> {
  readonly info: TTSProviderInfo<T>;
  readonly status: TTSStatus;

  init(): Promise<void>;
  speak(text: string, options: TTSSpeakOptions): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  stop(): void;
  cancel(): void;

  setSpeed(speed: number): void;
  setVoice(voiceId: string): void;

  getPlaybackState(): TTSPlaybackState;

  onWordBoundary?: (charIndex: number, charLength: number) => void;
  onEnd?: () => void;
  onLoadProgress?: (progress: TTSProgress) => void;
}
export type TTSProgress = { status: string; progress?: number };

export interface WordTiming {
  word: string;
  charIndex: number;
  charLength: number;
  startTime: number;
  endTime: number;
}

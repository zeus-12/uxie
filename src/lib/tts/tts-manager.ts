import { type TTSVoiceId } from ".";
import { BrowserTTSProvider } from "./providers/browser-provider";
import { KokoroProvider } from "./providers/kokoro-provider";
import type {
  TTSPlaybackState,
  TTSProgress,
  TTSProvider,
  TTSSpeakOptions,
  TTSStatus,
} from "./types";

const AVAILABLE_PROVIDERS = [
  { id: "browser", name: "Browser (System)" },
  { id: "kokoro", name: "Kokoro (Local AI)" },
] as const;

export type TTSProviderId = (typeof AVAILABLE_PROVIDERS)[number]["id"];

interface TTSManagerCallbacks {
  onWordBoundary?: (charIndex: number, charLength: number) => void;
  onEnd?: () => void;
  onLoadProgress?: (progress: TTSProgress) => void;
  onStatusChange?: (status: TTSStatus) => void;
}

export class TTSManager {
  private providers: Map<TTSProviderId, TTSProvider<TTSVoiceId>> = new Map();
  private currentProviderId: TTSProviderId = "browser";
  private callbacks: TTSManagerCallbacks = {};

  private currentText: string | null = null;
  private currentOptions: TTSSpeakOptions | null = null;
  private savedPlaybackState: TTSPlaybackState | null = null;

  constructor() {}

  private getOrCreateProvider(id: TTSProviderId): TTSProvider<TTSVoiceId> {
    let provider = this.providers.get(id);
    if (!provider) {
      if (id === "kokoro") {
        provider = new KokoroProvider();
      } else {
        provider = new BrowserTTSProvider();
      }

      this.setupProviderCallbacks(provider);
      this.providers.set(id, provider);
    }
    return provider;
  }

  private setupProviderCallbacks(provider: TTSProvider<TTSVoiceId>) {
    provider.onWordBoundary = (charIndex, charLength) => {
      this.callbacks.onWordBoundary?.(charIndex, charLength);
    };
    provider.onEnd = () => {
      this.callbacks.onEnd?.();
    };
    provider.onLoadProgress = (progress) => {
      this.callbacks.onLoadProgress?.(progress);
    };
  }

  get currentProvider(): TTSProvider<TTSVoiceId> {
    return this.getOrCreateProvider(this.currentProviderId);
  }

  get status(): TTSStatus {
    return this.currentProvider.status;
  }

  setCallbacks(callbacks: TTSManagerCallbacks) {
    this.callbacks = callbacks;
    // Update existing providers
    for (const provider of this.providers.values()) {
      this.setupProviderCallbacks(provider);
    }
  }

  async setProvider(id: TTSProviderId): Promise<void> {
    if (id === this.currentProviderId) return;

    const wasPlaying = this.currentProvider.status === "speaking";
    const wasPaused = this.currentProvider.status === "paused";

    if (wasPlaying || wasPaused) {
      this.savedPlaybackState = this.currentProvider.getPlaybackState();
      this.currentProvider.stop();
    }

    this.currentProviderId = id;
    const newProvider = this.getOrCreateProvider(id);

    // Resume from saved position if we were playing
    if (
      (wasPlaying || wasPaused) &&
      this.currentText &&
      this.savedPlaybackState
    ) {
      await this.resumeFromState(newProvider);
    }
  }

  private async resumeFromState(
    provider: TTSProvider<TTSVoiceId>,
  ): Promise<void> {
    if (!this.currentText || !this.savedPlaybackState || !this.currentOptions)
      return;

    const resumeText = this.currentText.slice(
      this.savedPlaybackState.charIndex,
    );
    if (!resumeText.trim()) return;

    await provider.speak(resumeText, {
      ...this.currentOptions,
      startCharIndex: this.savedPlaybackState.charIndex,
    });
  }

  async init(): Promise<void> {
    await this.currentProvider.init();
  }

  async speak(text: string, options: TTSSpeakOptions): Promise<void> {
    this.currentText = text;
    this.currentOptions = options;
    this.savedPlaybackState = null;
    await this.currentProvider.speak(text, options);
  }

  pause(): void {
    this.savedPlaybackState = this.currentProvider.getPlaybackState();
    this.currentProvider.pause();
  }

  async resume(): Promise<void> {
    await this.currentProvider.resume();
  }

  stop(): void {
    this.currentProvider.stop();
    this.currentText = null;
    this.currentOptions = null;
    this.savedPlaybackState = null;
  }

  cancel(): void {
    this.currentProvider.cancel();
  }

  async setSpeed(speed: number): Promise<void> {
    const wasPlaying = this.currentProvider.status === "speaking";

    if (wasPlaying) {
      this.savedPlaybackState = this.currentProvider.getPlaybackState();
      this.currentProvider.stop();
    }

    this.currentProvider.setSpeed(speed);
    if (this.currentOptions) {
      this.currentOptions.speed = speed;
    }

    if (wasPlaying && this.currentText && this.savedPlaybackState) {
      await this.resumeFromState(this.currentProvider);
    }
  }

  async setVoice(voiceId: string): Promise<void> {
    const wasPlaying = this.currentProvider.status === "speaking";

    if (wasPlaying) {
      this.savedPlaybackState = this.currentProvider.getPlaybackState();
      this.currentProvider.stop();
    }

    this.currentProvider.setVoice(voiceId);
    if (this.currentOptions) {
      this.currentOptions.voice = voiceId;
    }

    if (wasPlaying && this.currentText && this.savedPlaybackState) {
      await this.resumeFromState(this.currentProvider);
    }
  }

  getPlaybackState(): TTSPlaybackState {
    return this.currentProvider.getPlaybackState();
  }

  getAvailableProviders(): { id: TTSProviderId; name: string }[] {
    return [...AVAILABLE_PROVIDERS];
  }

  getCurrentProviderInfo() {
    return this.currentProvider.info;
  }
}

let managerInstance: TTSManager | null = null;

export function getTTSManager(): TTSManager {
  if (!managerInstance) {
    managerInstance = new TTSManager();
  }
  return managerInstance;
}

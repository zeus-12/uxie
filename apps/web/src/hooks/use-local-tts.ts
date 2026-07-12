import type { BaseAudioProvider } from "@/lib/tts/base-audio-provider";
import {
  KOKORO_VOICES,
  KokoroProvider,
} from "@/lib/tts/providers/kokoro-provider";
import {
  SUPERTONIC_VOICES,
  SupertonicProvider,
} from "@/lib/tts/providers/supertonic-provider";
import type { TTSStatus } from "@/lib/tts/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type LocalTtsEngine = "kokoro" | "supertonic";

const DEFAULT_VOICES: Record<LocalTtsEngine, string> = {
  kokoro: KOKORO_VOICES[0].id,
  supertonic: SUPERTONIC_VOICES[0].id,
};

type LocalTtsLoadProgress = {
  status: "downloading" | "loading" | "ready";
  progress?: number;
};

interface UseLocalTtsOptions {
  onWordBoundary?: (
    charIndex: number,
    charLength: number,
    spokenText: string,
  ) => void;
  onEnd?: () => void;
}

const providers = new Map<LocalTtsEngine, BaseAudioProvider<string>>();

function getProvider(engine: LocalTtsEngine): BaseAudioProvider<string> {
  let instance = providers.get(engine);

  if (!instance) {
    if (engine === "kokoro") {
      instance = new KokoroProvider();
    } else if (engine === "supertonic") {
      instance = new SupertonicProvider();
    } else {
      throw new Error("Invalid TTS engine.");
    }
    providers.set(engine, instance);
  }

  return instance;
}

export function useLocalTts(
  engine: LocalTtsEngine,
  options: UseLocalTtsOptions = {},
) {
  const [status, setStatus] = useState<TTSStatus>("idle");
  const [loadProgress, setLoadProgress] = useState<LocalTtsLoadProgress | null>(
    null,
  );

  const isStoppedRef = useRef(false);
  const isPausedRef = useRef(false);
  const currentTextRef = useRef("");
  const speedRef = useRef(1);
  const voiceRef = useRef(DEFAULT_VOICES[engine]);
  const modelLoadedRef = useRef(false);
  const loadingToastShownRef = useRef(false);
  const generatingToastIdRef = useRef<string | number | null>(null);

  const onEndRef = useRef(options.onEnd);
  onEndRef.current = options.onEnd;

  const onWordBoundaryRef = useRef(options.onWordBoundary);
  onWordBoundaryRef.current = options.onWordBoundary;

  const dismissGeneratingToast = useCallback(() => {
    if (generatingToastIdRef.current) {
      toast.dismiss(generatingToastIdRef.current);
      generatingToastIdRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    dismissGeneratingToast();
    isStoppedRef.current = true;
    getProvider(engine).stop();
    setStatus("idle");
  }, [dismissGeneratingToast, engine]);

  useEffect(() => {
    const provider = getProvider(engine);

    provider.onLoadProgress = (progress) => {
      setLoadProgress({
        status: progress.status as LocalTtsLoadProgress["status"],
        progress: progress.progress,
      });

      if (progress.status === "ready") {
        modelLoadedRef.current = true;
        return;
      }

      if (!modelLoadedRef.current && !loadingToastShownRef.current) {
        loadingToastShownRef.current = true;
        const isDownloading = progress.status === "downloading";

        toast.promise(
          new Promise<void>((resolve) => {
            const checkReady = setInterval(() => {
              if (modelLoadedRef.current) {
                clearInterval(checkReady);
                resolve();
              }
            }, 100);
          }),
          {
            loading: isDownloading
              ? "Downloading TTS model."
              : "Loading TTS model.",
            success: "Model ready!",
            error: "Failed to load model",
          },
        );
      }
    };

    provider.onEnd = () => {
      if (!isStoppedRef.current && !isPausedRef.current) {
        setStatus("idle");
        onEndRef.current?.();
      }
    };

    provider.onWordBoundary = (charIndex, charLength) => {
      if (!isStoppedRef.current && !isPausedRef.current) {
        onWordBoundaryRef.current?.(
          charIndex,
          charLength,
          currentTextRef.current,
        );
      }
    };

    provider.onGenerating = (isGenerating) => {
      if (isGenerating) {
        dismissGeneratingToast();
        generatingToastIdRef.current = toast.loading("Generating speech...", {
          duration: Infinity,
          action: {
            label: "Cancel",
            onClick: handleCancel,
          },
        });
      } else {
        dismissGeneratingToast();
      }
    };

    return () => {
      provider.onLoadProgress = undefined;
      provider.onEnd = undefined;
      provider.onWordBoundary = undefined;
      provider.onGenerating = undefined;
    };
  }, [engine, dismissGeneratingToast, handleCancel]);

  const speak = useCallback(
    async (text: string, opts: { speed: number }) => {
      if (isStoppedRef.current || isPausedRef.current) return;

      currentTextRef.current = text;
      speedRef.current = opts.speed;
      setStatus("loading");

      try {
        await getProvider(engine).speak(text, {
          speed: opts.speed,
          voice: voiceRef.current,
        });
        if (!isStoppedRef.current && !isPausedRef.current) {
          setStatus("idle");
        }
      } catch (err) {
        console.error(`[TTS ${engine}] Speak error:`, err);
        dismissGeneratingToast();
        setStatus("idle");
      }
    },
    [engine, dismissGeneratingToast],
  );

  const pregenerate = useCallback(
    async (text: string) => {
      const provider = getProvider(engine);
      provider.setVoice(voiceRef.current);
      provider.setSpeed(speedRef.current);
      await provider.pregenerate(text);
    },
    [engine],
  );

  const pause = useCallback(() => {
    isPausedRef.current = true;
    getProvider(engine).pause();
    setStatus("paused");
  }, [engine]);

  const resume = useCallback(async () => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    isStoppedRef.current = false;
    setStatus("speaking");
    await getProvider(engine).resume();
  }, [engine]);

  const stop = useCallback(() => {
    isStoppedRef.current = true;
    isPausedRef.current = false;
    dismissGeneratingToast();
    getProvider(engine).stop();
    currentTextRef.current = "";
    setStatus("idle");
  }, [engine, dismissGeneratingToast]);

  const reset = useCallback(() => {
    isStoppedRef.current = false;
    isPausedRef.current = false;
  }, []);

  const setVoice = useCallback(
    (voice: string) => {
      voiceRef.current = voice;
      getProvider(engine).setVoice(voice);
    },
    [engine],
  );

  const changeSpeed = useCallback(
    (speed: number) => {
      speedRef.current = speed;
      getProvider(engine).setSpeed(speed);
    },
    [engine],
  );

  const restartAtNewSpeed = useCallback(
    async (newSpeed: number) => {
      const text = currentTextRef.current;
      if (!text) {
        changeSpeed(newSpeed);
        return;
      }

      getProvider(engine).stop();
      changeSpeed(newSpeed);
      setStatus("loading");

      try {
        await getProvider(engine).speak(text, {
          speed: newSpeed,
          voice: voiceRef.current,
        });
        if (!isStoppedRef.current && !isPausedRef.current) {
          setStatus("idle");
        }
      } catch (err) {
        console.error(`[TTS ${engine}] restartAtNewSpeed error:`, err);
        setStatus("idle");
      }
    },
    [engine, changeSpeed],
  );

  const clearCache = useCallback(() => {
    getProvider(engine).clearCache();
  }, [engine]);

  return {
    speak,
    pregenerate,
    pause,
    resume,
    stop,
    reset,
    status,
    setVoice,
    changeSpeed,
    restartAtNewSpeed,
    loadProgress,
    clearCache,
    getIsPaused: () => isPausedRef.current,
    canResume: () =>
      isPausedRef.current && getProvider(engine).canResumeFromPosition,
    getVoice: () => voiceRef.current,
  };
}

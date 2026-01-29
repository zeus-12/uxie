import { KokoroProvider } from "@/lib/tts/providers/kokoro-provider";
import type { TTSStatus } from "@/lib/tts/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type KokoroLoadProgress = {
  status: "downloading" | "loading" | "ready";
  progress?: number;
};

interface UseTtsLocalOptions {
  onEnd?: () => void;
}

let providerInstance: KokoroProvider | null = null;

function getProvider(): KokoroProvider {
  if (!providerInstance) {
    providerInstance = new KokoroProvider();
  }
  return providerInstance;
}

export function useTtsLocal(options: UseTtsLocalOptions = {}) {
  const [status, setStatus] = useState<TTSStatus>("idle");
  const [loadProgress, setLoadProgress] = useState<KokoroLoadProgress | null>(
    null,
  );

  const isStoppedRef = useRef(false);
  const isPausedRef = useRef(false);
  const currentTextRef = useRef("");
  const speedRef = useRef(1);
  const voiceRef = useRef("af_heart");
  const modelLoadedRef = useRef(false);
  const loadingToastShownRef = useRef(false);
  const generatingToastIdRef = useRef<string | number | null>(null);

  const onEndRef = useRef(options.onEnd);
  onEndRef.current = options.onEnd;

  const dismissGeneratingToast = useCallback(() => {
    if (generatingToastIdRef.current) {
      toast.dismiss(generatingToastIdRef.current);
      generatingToastIdRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    dismissGeneratingToast();
    isStoppedRef.current = true;
    getProvider().stop();
    setStatus("idle");
  }, [dismissGeneratingToast]);

  useEffect(() => {
    const provider = getProvider();

    provider.onLoadProgress = (progress) => {
      setLoadProgress({
        status: progress.status as KokoroLoadProgress["status"],
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
      provider.onGenerating = undefined;
    };
  }, [dismissGeneratingToast, handleCancel]);

  const speak = useCallback(
    async (text: string, opts: { speed: number }) => {
      if (isStoppedRef.current || isPausedRef.current) return;

      currentTextRef.current = text;
      speedRef.current = opts.speed;
      setStatus("loading");

      try {
        await getProvider().speak(text, {
          speed: opts.speed,
          voice: voiceRef.current,
        });
        if (!isStoppedRef.current && !isPausedRef.current) {
          setStatus("idle");
        }
      } catch (err) {
        console.error("[TTS] Speak error:", err);
        dismissGeneratingToast();
        setStatus("idle");
      }
    },
    [dismissGeneratingToast],
  );

  const pregenerate = useCallback(async (text: string) => {
    const provider = getProvider();
    provider.setVoice(voiceRef.current);
    provider.setSpeed(speedRef.current);
    await provider.pregenerate(text);
  }, []);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    getProvider().pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(async () => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    await getProvider().resume();
    setStatus("speaking");
  }, []);

  const stop = useCallback(() => {
    isStoppedRef.current = true;
    isPausedRef.current = false;
    dismissGeneratingToast();
    getProvider().stop();
    currentTextRef.current = "";
    setStatus("idle");
  }, [dismissGeneratingToast]);

  const reset = useCallback(() => {
    isStoppedRef.current = false;
    isPausedRef.current = false;
  }, []);

  const setVoice = useCallback((voice: string) => {
    voiceRef.current = voice;
    getProvider().setVoice(voice);
  }, []);

  const changeSpeed = useCallback((speed: number) => {
    speedRef.current = speed;
    getProvider().setSpeed(speed);
  }, []);

  const restartAtNewSpeed = useCallback(
    async (newSpeed: number) => {
      const text = currentTextRef.current;
      if (!text) {
        changeSpeed(newSpeed);
        return;
      }

      getProvider().stop();
      changeSpeed(newSpeed);
      setStatus("loading");

      try {
        await getProvider().speak(text, {
          speed: newSpeed,
          voice: voiceRef.current,
        });
        if (!isStoppedRef.current && !isPausedRef.current) {
          setStatus("idle");
        }
      } catch (err) {
        console.error("[TTS] restartAtNewSpeed error:", err);
        setStatus("idle");
      }
    },
    [changeSpeed],
  );

  const clearCache = useCallback(() => {
    getProvider().clearCache();
  }, []);

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
    canResume: () => isPausedRef.current,
    getVoice: () => voiceRef.current,
  };
}

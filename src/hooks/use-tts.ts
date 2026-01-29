import { getTTSManager, type TTSProviderId } from "@/lib/tts/tts-manager";
import type { TTSProgress, TTSSpeakOptions, TTSStatus } from "@/lib/tts/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UseTTSOptions {
  onWordBoundary?: (charIndex: number, charLength: number) => void;
  onEnd?: () => void;
  onLoadProgress?: (progress: TTSProgress) => void;
}

export function useTTS(options: UseTTSOptions = {}) {
  const [status, setStatus] = useState<TTSStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const manager = useRef(getTTSManager());
  const toastIdRef = useRef<string | number | null>(null);
  const cancelCallbackRef = useRef<(() => void) | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const mgr = manager.current;

    mgr.setCallbacks({
      onWordBoundary: (charIndex, charLength) => {
        optionsRef.current.onWordBoundary?.(charIndex, charLength);
      },
      onEnd: () => {
        setStatus("idle");
        setIsLoading(false);
        dismissLoadingToast();
        optionsRef.current.onEnd?.();
      },
      onLoadProgress: (progress) => {
        optionsRef.current.onLoadProgress?.(progress);
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
    });
  }, []);

  const dismissLoadingToast = useCallback(() => {
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }
  }, []);

  const showLoadingToast = useCallback(
    (onCancel: () => void) => {
      dismissLoadingToast();
      cancelCallbackRef.current = onCancel;

      toastIdRef.current = toast.loading("Generating speech...", {
        duration: Infinity,
        action: {
          label: "Cancel",
          onClick: () => {
            cancelCallbackRef.current?.();
            dismissLoadingToast();
          },
        },
      });
    },
    [dismissLoadingToast],
  );

  const speak = useCallback(
    async (text: string, speakOptions: Omit<TTSSpeakOptions, "onCancel">) => {
      const mgr = manager.current;

      setIsLoading(true);
      setStatus("loading");

      const cancelFn = () => {
        mgr.cancel();
        setIsLoading(false);
        setStatus("idle");
      };

      showLoadingToast(cancelFn);

      try {
        await mgr.speak(text, {
          ...speakOptions,
          onCancel: cancelFn,
        });
        dismissLoadingToast();
        setStatus(mgr.status);
      } catch (err) {
        console.error("[useTTS] Error:", err);
        dismissLoadingToast();
        setStatus("idle");
      } finally {
        setIsLoading(false);
      }
    },
    [showLoadingToast, dismissLoadingToast],
  );

  const pause = useCallback(() => {
    manager.current.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(async () => {
    await manager.current.resume();
    setStatus(manager.current.status);
  }, []);

  const stop = useCallback(() => {
    manager.current.stop();
    dismissLoadingToast();
    setStatus("idle");
    setIsLoading(false);
  }, [dismissLoadingToast]);

  const cancel = useCallback(() => {
    manager.current.cancel();
    dismissLoadingToast();
    setStatus("idle");
    setIsLoading(false);
  }, [dismissLoadingToast]);

  const setProvider = useCallback(
    async (providerId: TTSProviderId) => {
      const wasLoading = isLoading;
      if (wasLoading) {
        showLoadingToast(() => manager.current.cancel());
      }

      await manager.current.setProvider(providerId);
      setStatus(manager.current.status);

      if (!wasLoading) {
        dismissLoadingToast();
      }
    },
    [isLoading, showLoadingToast, dismissLoadingToast],
  );

  const setSpeed = useCallback(
    async (speed: number) => {
      const wasLoading = isLoading;
      if (wasLoading) {
        showLoadingToast(() => manager.current.cancel());
      }

      await manager.current.setSpeed(speed);
      setStatus(manager.current.status);

      if (!wasLoading) {
        dismissLoadingToast();
      }
    },
    [isLoading, showLoadingToast, dismissLoadingToast],
  );

  const setVoice = useCallback(
    async (voiceId: string) => {
      const wasLoading = isLoading;
      if (wasLoading) {
        showLoadingToast(() => manager.current.cancel());
      }

      await manager.current.setVoice(voiceId);
      setStatus(manager.current.status);

      if (!wasLoading) {
        dismissLoadingToast();
      }
    },
    [isLoading, showLoadingToast, dismissLoadingToast],
  );

  const getPlaybackState = useCallback(() => {
    return manager.current.getPlaybackState();
  }, []);

  const getAvailableProviders = useCallback(() => {
    return manager.current.getAvailableProviders();
  }, []);

  const getCurrentProviderInfo = useCallback(() => {
    return manager.current.getCurrentProviderInfo();
  }, []);

  return {
    status,
    isLoading,
    speak,
    pause,
    resume,
    stop,
    cancel,
    setProvider,
    setSpeed,
    setVoice,
    getPlaybackState,
    getAvailableProviders,
    getCurrentProviderInfo,
  };
}

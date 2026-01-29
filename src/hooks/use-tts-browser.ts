import { useCallback, useEffect, useRef, useState } from "react";
import { BROWSER_VOICES } from "@/lib/tts/providers/browser-provider";
import type { TTSStatus } from "@/lib/tts/types";


const DEFAULT_VOICE = BROWSER_VOICES[0].id;

interface UseTtsBrowserOptions {
  onWordBoundary?: (charIndex: number, charLength: number, spokenText: string) => void;
  onEnd?: () => void;
}

export function useTtsBrowser(options: UseTtsBrowserOptions = {}) {
  const [status, setStatus] = useState<TTSStatus>("idle");
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isStoppedRef = useRef(false);
  const isPausedRef = useRef(false);
  const onWordBoundaryRef = useRef(options.onWordBoundary);
  const onEndRef = useRef(options.onEnd);

  onWordBoundaryRef.current = options.onWordBoundary;
  onEndRef.current = options.onEnd;

  useEffect(() => {
    speechSynthesisRef.current = window.speechSynthesis;

    return () => {
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  const speak = useCallback(
    async (
      text: string,
      opts: { speed: number; voice?: string; startCharIndex?: number },
    ): Promise<void> => {
      if (!speechSynthesisRef.current || isStoppedRef.current) return;

      const textToRead = opts.startCharIndex
        ? text.substring(opts.startCharIndex)
        : text;
      const lengthDiff = text.length - textToRead.length;

      if (speechSynthesisRef.current.speaking) {
        speechSynthesisRef.current.cancel();
      }

      setStatus("speaking");
      isPausedRef.current = false;

      const utterance = new SpeechSynthesisUtterance(textToRead);

      const voices = speechSynthesisRef.current.getVoices();
      utterance.voice =
        voices.find((voice) => voice.name === (opts.voice || DEFAULT_VOICE)) || null;

      utterance.rate = opts.speed;
      utteranceRef.current = utterance;
      speechSynthesisRef.current.speak(utterance);

      return new Promise<void>((resolve) => {
        utterance.onboundary = (event) => {
          if (event.name === "word" && !isStoppedRef.current) {
            onWordBoundaryRef.current?.(
              event.charIndex + lengthDiff,
              event.charLength,
              text,
            );
          }
        };

        utterance.onend = () => {
          if (!isStoppedRef.current && !isPausedRef.current) {
            setStatus("idle");
            onEndRef.current?.();
          }
          resolve();
        };

        utterance.onerror = () => {
          if (!isStoppedRef.current) {
            setStatus("idle");
          }
          resolve();
        };
      });
    },
    [],
  );

  const pause = useCallback(() => {
    isPausedRef.current = true;
    if (speechSynthesisRef.current?.speaking) {
      speechSynthesisRef.current.pause();
    }
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    if (speechSynthesisRef.current?.paused) {
      speechSynthesisRef.current.resume();
    }
    setStatus("speaking");
  }, []);

  const stop = useCallback(() => {
    isStoppedRef.current = true;
    isPausedRef.current = false;

    // Cancel FIRST, then cleanup
    speechSynthesisRef.current?.cancel();

    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onboundary = null;
      utteranceRef.current = null;
    }
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    isStoppedRef.current = false;
    isPausedRef.current = false;
  }, []);

  const changeSpeed = useCallback((newSpeed: number) => {
    if (utteranceRef.current) {
      utteranceRef.current.rate = newSpeed;
    }
  }, []);

  const isSpeaking = useCallback(() => {
    return speechSynthesisRef.current?.speaking ?? false;
  }, []);

  return {
    speak,
    pause,
    resume,
    stop,
    reset,
    status,
    changeSpeed,
    isSpeaking,
  };
}

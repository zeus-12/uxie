import { useCallback, useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";

export type IpcCompletion = {
  complete: (prompt: string) => void;
  completion: string;
  isLoading: boolean;
  stop: () => void;
};

/**
 * IPC-backed equivalent of the AI SDK's useCompletion. Streams a text
 * continuation from the main process and accumulates it into `completion`.
 */
export function useIpcCompletion(opts?: {
  onError?: (message: string) => void;
}): IpcCompletion {
  const [completion, setCompletion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const streamIdRef = useRef<string | null>(null);
  const onErrorRef = useRef(opts?.onError);
  onErrorRef.current = opts?.onError;

  useEffect(() => {
    const offDelta = window.uxieAPI.onCompletionDelta((sid, delta) => {
      if (sid !== streamIdRef.current) return;
      setCompletion((c) => c + delta);
    });
    const offDone = window.uxieAPI.onCompletionDone((sid) => {
      if (sid !== streamIdRef.current) return;
      setIsLoading(false);
      streamIdRef.current = null;
    });
    const offError = window.uxieAPI.onCompletionError((sid, msg) => {
      if (sid !== streamIdRef.current) return;
      setIsLoading(false);
      streamIdRef.current = null;
      onErrorRef.current?.(msg);
    });
    return () => {
      offDelta();
      offDone();
      offError();
      if (streamIdRef.current) window.uxieAPI.cancelCompletion(streamIdRef.current);
    };
  }, []);

  const complete = useCallback((prompt: string) => {
    const sid = createId();
    streamIdRef.current = sid;
    setCompletion("");
    setIsLoading(true);
    window.uxieAPI.startCompletion(sid, prompt);
  }, []);

  const stop = useCallback(() => {
    if (streamIdRef.current) window.uxieAPI.cancelCompletion(streamIdRef.current);
    streamIdRef.current = null;
    setIsLoading(false);
  }, []);

  return { complete, completion, isLoading, stop };
}

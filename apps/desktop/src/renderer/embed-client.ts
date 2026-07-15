// Runs the transformers.js embedding model in a Web Worker so it never blocks
// the renderer's main thread (embedding a whole PDF would otherwise freeze the UI).
let worker: Worker | null = null;
let nextId = 1;

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: (done: number, total: number) => void;
}
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./embed-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent) => {
      const { id, ok, result, error, progress } = e.data;
      const p = pending.get(id);
      if (!p) return;
      if (progress) {
        p.onProgress?.(progress.done, progress.total);
        return;
      }
      pending.delete(id);
      if (ok) p.resolve(result);
      else p.reject(new Error(error));
    };
  }
  return worker;
}

export function embedTextInWorker(text: string): Promise<number[]> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    getWorker().postMessage({ id, type: "embed", text });
  });
}

export function embedBatchInWorker(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, {
      resolve: resolve as (v: unknown) => void,
      reject,
      onProgress,
    });
    getWorker().postMessage({ id, type: "embedBatch", texts });
  });
}

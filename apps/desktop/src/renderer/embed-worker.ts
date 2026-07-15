import { embedBatch, embedText } from "@uxie/shared/lib/embeddings";

type Req =
  | { id: number; type: "embed"; text: string }
  | { id: number; type: "embedBatch"; texts: string[] };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<Req>) => void) | null;
  postMessage: (m: unknown) => void;
};

ctx.onmessage = async (e: MessageEvent<Req>) => {
  const req = e.data;
  try {
    const result =
      req.type === "embed"
        ? await embedText(req.text)
        : await embedBatch(req.texts, (done, total) =>
            ctx.postMessage({ id: req.id, progress: { done, total } }),
          );
    ctx.postMessage({ id: req.id, ok: true, result });
  } catch (err) {
    ctx.postMessage({
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

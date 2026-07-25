/**
 * Both apps embed with bge-base-en-v1.5 — `Xenova/…` is an ONNX export of the
 * `BAAI/…` weights, same architecture and same 768-dim output. They differ only
 * in *where* inference runs: desktop runs it on-device, web calls the HF API.
 *
 * The stores still aren't interchangeable (desktop uses the q8 build, so vectors
 * differ in the low bits), but the dimension now matches, so a future sync is
 * possible. Each model is declared with its dimension so a swap can't silently
 * disagree with the store that was sized for it.
 */

/** Desktop: runs locally in-process via transformers.js, stored in sqlite-vec. */
export const DESKTOP_EMBEDDING = {
  model: "Xenova/bge-base-en-v1.5",
  dim: 768,
} as const;

/** Web: called over the Hugging Face inference API, stored in Pinecone. */
export const WEB_EMBEDDING = {
  model: "BAAI/bge-base-en-v1.5",
  dim: 768,
} as const;

import {
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

// 384-dim; must match EMBEDDING_DIM in the main-process vector store.
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    // `pipeline`'s overloads form a union too large for TS to represent, so cast.
    extractorPromise = pipeline(
      "feature-extraction",
      EMBEDDING_MODEL,
    ) as unknown as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export async function embedBatch(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  const extractor = await getExtractor();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const output = await extractor(texts[i], {
      pooling: "mean",
      normalize: true,
    });
    out.push(Array.from(output.data as Float32Array));
    onProgress?.(i + 1, texts.length);
  }
  return out;
}

export function chunkText(text: string, size = 1000): string[] {
  const paras = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && (cur + p).length > size) {
      chunks.push(cur);
      cur = "";
    }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur.trim()) chunks.push(cur);
  return chunks.filter((c) => c.trim().length > 20);
}

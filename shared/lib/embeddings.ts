import {
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { DESKTOP_EMBEDDING } from "./embedding-models";

// This module is the desktop's local embedder; the web app embeds via the HF API.
export const EMBEDDING_MODEL = DESKTOP_EMBEDDING.model;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    // dtype is pinned deliberately: the default depends on the detected device
    // (cpu → fp32, a 436MB download; wasm → q8, 110MB). q8 is ~2.6x faster than
    // fp32 here and a quarter of the size, so don't let the environment decide.
    // `pipeline`'s overloads form a union too large for TS to represent, so cast.
    extractorPromise = pipeline("feature-extraction", EMBEDDING_MODEL, {
      dtype: "q8",
    }) as unknown as Promise<FeatureExtractionPipeline>;
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

// Same splitter + config the web app uses (langchain RecursiveCharacterTextSplitter
// 1000 / 200 overlap) so chunking matches; only the embedding model differs.
export async function chunkText(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await splitter.splitText(text);
  return chunks.filter((c) => c.trim().length > 20);
}

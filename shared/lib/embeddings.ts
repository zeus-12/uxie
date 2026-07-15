import {
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

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

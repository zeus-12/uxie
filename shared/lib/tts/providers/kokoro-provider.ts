import {
  AutoTokenizer,
  type PreTrainedTokenizer,
  StyleTextToSpeech2Model,
  Tensor,
} from "@huggingface/transformers";
import { type GenerateOptions, TextSplitterStream } from "kokoro-js";
import { phonemize } from "phonemizer";
import { getDevice, getDeviceType } from "..";
import { BaseAudioProvider } from "../base-audio-provider";
import type {
  CachedAudio,
  TTSGenerationParams,
  TTSProviderInfo,
  TTSVoice,
  WordTiming,
} from "../types";
import {
  combineSamples,
  findChunkPosition,
  wordTimingsFromPhonemeDurations,
} from "../utils";

export type KokoroVoiceId = NonNullable<GenerateOptions["voice"]>;

export const KOKORO_VOICES = [
  { id: "af_heart", name: "Heart (Female)", gender: "female" },
  { id: "af_nicole", name: "Nicole (Female)", gender: "female" },
  { id: "am_echo", name: "Echo (Male)", gender: "male" },
  { id: "bm_fable", name: "Fable (Male)", gender: "male" },
] as const satisfies TTSVoice<KokoroVoiceId>[];

const SAMPLE_RATE = 24000;
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX-timestamped";
const VOICES_URL =
  "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices";
const VOICE_CACHE = "kokoro-voices";
const STYLE_DIM = 256;
const MAX_STYLE_INDEX = 509;

const voices = new Map<string, Float32Array>();

function normalizeNumber(value: string): string {
  if (value.includes(".")) return value;
  if (value.includes(":")) {
    const [hours = 0, minutes = 0] = value.split(":").map(Number);
    if (minutes === 0) return `${hours} o'clock`;
    return minutes < 10 ? `${hours} oh ${minutes}` : `${hours} ${minutes}`;
  }

  const year = Number.parseInt(value.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return value;
  const first = value.slice(0, 2);
  const last = Number.parseInt(value.slice(2, 4), 10);
  const suffix = value.endsWith("s") ? "s" : "";
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (last === 0) return `${first} hundred${suffix}`;
    if (last < 10) return `${first} oh ${last}${suffix}`;
  }
  return `${first} ${last}${suffix}`;
}

function normalizeCurrency(value: string): string {
  const unit = value[0] === "$" ? "dollar" : "pound";
  const amount = value.slice(1);
  if (Number.isNaN(Number(amount))) return `${amount} ${unit}s`;
  if (!amount.includes(".")) {
    return `${amount} ${unit}${amount === "1" ? "" : "s"}`;
  }

  const [whole, decimal] = amount.split(".");
  const minor = Number.parseInt(decimal!.padEnd(2, "0"), 10);
  const minorUnit =
    value[0] === "$"
      ? minor === 1
        ? "cent"
        : "cents"
      : minor === 1
        ? "penny"
        : "pence";
  return `${whole} ${unit}${whole === "1" ? "" : "s"} and ${minor} ${minorUnit}`;
}

function normalizeDecimal(value: string): string {
  const [whole, decimal] = value.split(".");
  return `${whole} point ${decimal!.split("").join(" ")}`;
}

async function loadVoice(voice: string): Promise<Float32Array> {
  const loaded = voices.get(voice);
  if (loaded) return loaded;

  const url = `${VOICES_URL}/${voice}.bin`;
  let cache: Cache | null = null;
  try {
    cache =
      typeof caches === "undefined" ? null : await caches.open(VOICE_CACHE);
  } catch {
    cache = null;
  }

  let buffer = await (await cache?.match(url))?.arrayBuffer();
  if (!buffer) {
    const response = await fetch(url);
    buffer = await response.arrayBuffer();
    try {
      await cache?.put(url, new Response(buffer, { headers: response.headers }));
    } catch {}
  }

  const data = new Float32Array(buffer);
  voices.set(voice, data);
  return data;
}

function normalizeForKokoro(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/«/g, "“")
    .replace(/»/g, "”")
    .replace(/[“”]/g, '"')
    .replace(/\(/g, "«")
    .replace(/\)/g, "»")
    .replace(/、/g, ", ")
    .replace(/。/g, ". ")
    .replace(/！/g, "! ")
    .replace(/，/g, ", ")
    .replace(/：/g, ": ")
    .replace(/；/g, "; ")
    .replace(/？/g, "? ")
    .replace(/[^\S \n]/g, " ")
    .replace(/  +/g, " ")
    .replace(/(?<=\n) +(?=\n)/g, "")
    .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor")
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister")
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs")
    .replace(/\betc\.(?! [A-Z])/gi, "etc")
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(
      /\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g,
      normalizeNumber,
    )
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(
      /[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi,
      normalizeCurrency,
    )
    .replace(/\d*\.\d+/g, normalizeDecimal)
    .replace(/(?<=\d)-(?=\d)/g, " to ")
    .replace(/(?<=\d)S/g, " S")
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, "s")
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (value) =>
      value.replace(/\./g, "-"),
    )
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-")
    .trim();
}

const PUNCTUATION = ";:,.!?¡¿—…\"«»“”(){}[]";
const ESCAPED_PUNCTUATION = PUNCTUATION.replace(
  /[.*+?^${}()|[\]\\]/g,
  "\\$&",
);
const PUNCTUATION_RUN = new RegExp(
  `(\\s*[${ESCAPED_PUNCTUATION}]+\\s*)+`,
  "g",
);

function splitKeepingMatches(text: string, pattern: RegExp) {
  const parts: Array<{ punctuation: boolean; text: string }> = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    if (cursor < index) {
      parts.push({ punctuation: false, text: text.slice(cursor, index) });
    }
    if (match[0]) parts.push({ punctuation: true, text: match[0] });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    parts.push({ punctuation: false, text: text.slice(cursor) });
  }
  return parts;
}

// Same eSpeak pipeline and post-processing as kokoro-js 1.2.1. There is no
// custom dictionary or pronunciation override in this path.
async function phonemizeForKokoro(
  text: string,
  language: "a" | "b",
  preserveWordBoundaries = false,
): Promise<string> {
  const normalized = normalizeForKokoro(text);
  const voice = language === "a" ? "en-us" : "en";
  const parts = splitKeepingMatches(normalized, PUNCTUATION_RUN);
  const result = (
    await Promise.all(
      parts.map(async (part) =>
        part.punctuation
          ? preserveWordBoundaries
            ? " "
            : part.text
          : (
              await phonemize(
                preserveWordBoundaries
                  ? part.text.trim().replace(/\s+/g, "|")
                  : part.text,
                voice,
              )
            ).join(" "),
      ),
    )
  ).join(preserveWordBoundaries ? " " : "");

  let output = result
    .replace(/kəkˈoːɹoʊ/g, "kˈoʊkəɹoʊ")
    .replace(/kəkˈɔːɹəʊ/g, "kˈəʊkəɹəʊ")
    .replace(/ʲ/g, "j")
    .replace(/r/g, "ɹ")
    .replace(/x/g, "k")
    .replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ")
    .replace(/ z(?=[;:,.!?¡¿—…\"«»“” ]|$)/g, "z");

  if (language === "a") {
    output = output.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  }
  return output.trim();
}

export class KokoroProvider extends BaseAudioProvider<KokoroVoiceId> {
  private model: StyleTextToSpeech2Model | null = null;
  private tokenizer: PreTrainedTokenizer | null = null;

  readonly info: TTSProviderInfo<KokoroVoiceId> = {
    id: "kokoro",
    name: "Kokoro (Local)",
    supportsStreaming: true,
    supportsOfflineUse: true,
    voices: KOKORO_VOICES,
  };

  constructor() {
    super(KOKORO_VOICES[0].id);
  }

  get isModelLoaded(): boolean {
    return this.model !== null && this.tokenizer !== null;
  }

  protected async loadModel(): Promise<void> {
    const isFromCache = await this.isModelCached();
    this.onLoadProgress?.({ status: isFromCache ? "loading" : "downloading" });

    const device = await getDevice();
    const dtype = await getDeviceType();
    const progress_callback = (data: { status: string; progress?: number }) => {
      if (data.status === "progress" && data.progress !== undefined) {
        this.onLoadProgress?.({
          status: isFromCache ? "loading" : "downloading",
          progress: data.progress,
        });
      }
    };

    [this.model, this.tokenizer] = await Promise.all([
      StyleTextToSpeech2Model.from_pretrained(MODEL_ID, {
        dtype,
        device,
        progress_callback,
      }),
      AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback }),
    ]);

    this.onLoadProgress?.({ status: "ready" });
  }

  protected async isModelCached(): Promise<boolean> {
    if (typeof caches === "undefined") return false;
    try {
      const cache = await caches.open("transformers-cache");
      const keys = await cache.keys();
      return keys.some((req) => req.url.includes("Kokoro"));
    } catch {
      return false;
    }
  }

  protected async generateAudio(
    text: string,
    params: TTSGenerationParams,
  ): Promise<CachedAudio | null> {
    try {
      await this.init();
      const { model, tokenizer } = this;
      if (!model || !tokenizer) return null;

      const splitter = new TextSplitterStream();
      splitter.push(text);
      const chunks = [...splitter];
      const language = params.voice.startsWith("a") ? "a" : "b";
      const voiceData = await loadVoice(params.voice);
      const audioContext = this.getAudioContext();
      const allSamples: Float32Array[] = [];
      const wordTimings: WordTiming[] = [];
      let currentTimeMs = 0;
      let searchStartIndex = 0;
      let aligned = true;

      for (const chunk of chunks) {
        const [phonemes, separatedPhonemes] = await Promise.all([
          phonemizeForKokoro(chunk, language),
          phonemizeForKokoro(chunk, language, true),
        ]);
        const { input_ids } = tokenizer(phonemes, { truncation: true });
        const numTokens = Math.min(
          Math.max(input_ids.size - 2, 0),
          MAX_STYLE_INDEX,
        );
        const offset = numTokens * STYLE_DIM;
        const output = await model({
          input_ids,
          style: new Tensor(
            "float32",
            voiceData.slice(offset, offset + STYLE_DIM),
            [1, STYLE_DIM],
          ),
          speed: new Tensor("float32", [params.speed], [1]),
        });

        const samples = output.waveform.data as Float32Array;
        allSamples.push(samples);
        const chunkStart = findChunkPosition(text, chunk, searchStartIndex);
        const durations = output.durations?.data as Float32Array | undefined;
        if (chunkStart === -1 || !durations) {
          aligned = false;
        } else {
          const timings = wordTimingsFromPhonemeDurations(
            chunk,
            phonemes,
            separatedPhonemes,
            chunkStart,
            currentTimeMs,
            durations,
          );
          if (timings) wordTimings.push(...timings);
          else aligned = false;
          searchStartIndex = chunkStart + chunk.length;
        }
        currentTimeMs += (samples.length / SAMPLE_RATE) * 1000;
      }

      if (allSamples.length === 0) return null;
      const combined = combineSamples(allSamples);
      const audioBuffer = audioContext.createBuffer(
        1,
        combined.length,
        SAMPLE_RATE,
      );
      audioBuffer.copyToChannel(combined, 0);

      // Never return a partial or inferred alignment. If source words do not
      // map exactly to the model's phoneme boundaries, show no word overlay.
      return { audioBuffer, wordTimings: aligned ? wordTimings : [] };
    } catch (err) {
      console.error("[KokoroProvider] Generation error:", err);
      return null;
    }
  }
}

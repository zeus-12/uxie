import { createPdfTextSource, usePdfTextStore } from "@uxie/shared/lib/pdf-text";
import { afterEach, describe, expect, it } from "vitest";
import { fakeRangeClientRects, mountReader } from "./helpers/sentence-reader";

fakeRangeClientRects();

const ITEMS = ["Reading deeply is a ", "different craft. It is slower, ", "more deliberate."];

const canvas = () =>
  `<div class="page" data-page-number="1"><div class="textLayer">${ITEMS.map(
    (t) => `<span role="presentation">${t}</span>`,
  ).join("")}<div class="endOfContent"></div></div></div>`;

const reflow = () =>
  `<div class="reflow-layer" data-active=""><section data-reflow-page="1" data-page-w="600" data-page-h="800"><p data-reflow-block="">${ITEMS.map(
    (t, i) => `<span data-run="1:${i}" data-run-start="0" data-item-ordinal="${i}">${t.trim()}</span>`,
  ).join(" ")}</p></section></div>`;

const hl = (cls: string) => {
  const el = document.querySelector(`.${cls}`);
  return { text: el?.getAttribute("data-hl-text") ?? null, onReflow: Boolean(el?.closest("[data-reflow-page]")) };
};

afterEach(() => {
  usePdfTextStore.getState().setSource(null);
  document.body.innerHTML = "";
});

describe("read-aloud text model across surfaces", () => {
  it("keeps the sentence and word when the page switches to reflowed text", () => {
    document.body.innerHTML = canvas();
    const reader = mountReader(1);
    reader.startFromPage(1);
    reader.advanceToNextSentence();
    reader.highlightWordInSentence(3, 2, "tts");
    expect(hl("tts-hl-sentence")).toEqual({ text: "It is slower, more deliberate.", onReflow: false });
    expect(hl("tts-hl-word")).toEqual({ text: "is", onReflow: false });

    document.body.insertAdjacentHTML("beforeend", reflow());
    document.dispatchEvent(new CustomEvent("reflow:layout"));
    expect(hl("tts-hl-sentence")).toEqual({ text: "It is slower, more deliberate.", onReflow: true });
    expect(hl("tts-hl-word")).toEqual({ text: "is", onReflow: true });
    expect(document.querySelectorAll(".tts-hl-word").length).toBe(1);
  });

  it("reads a page from pdf.js text content when its text layer isn't rendered", async () => {
    const doc = {
      numPages: 2,
      getPage: async () => ({
        getTextContent: async () => ({ items: [{ str: "Page two begins here." }, { str: "" }, { type: "beginMarkedContent" }] }),
      }),
    };
    const source = createPdfTextSource(doc as never);
    usePdfTextStore.getState().setSource(source);
    source.prefetch(2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(source.blocks(2)).toEqual(["Page two begins here."]);
    const reader = mountReader(2);
    expect(reader.startFromPage(2)?.sentence).toBe("Page two begins here.");
  });

  it("waits on a page whose text layer hasn't finished instead of skipping it", () => {
    const page = (n: number, done: boolean, text: string) =>
      `<div class="page" data-page-number="${n}"><div class="textLayer"><span role="presentation">${text}</span>${done ? '<div class="endOfContent"></div>' : ""}</div></div>`;
    document.body.innerHTML =
      page(1, true, "Page one ends here.") + page(2, false, "Page two is still") + page(3, true, "Page three.");
    const reader = mountReader(3);
    expect(reader.startFromPage(1)?.sentence).toBe("Page one ends here.");
    expect(reader.advanceToNextSentence()).toBeNull();
    expect(reader.getCurrentPage()).toBe(1);
  });

  it("crosses an empty page onto one whose text is still loading", async () => {
    const texts: Record<number, string[]> = { 1: ["Page one ends here."], 2: [], 3: ["Page three starts."] };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const doc = {
      numPages: 3,
      getPage: async (n: number) => ({
        getTextContent: async () => {
          if (n === 3) await gate;
          return { items: texts[n]!.map((str) => ({ str })) };
        },
      }),
    };
    const source = createPdfTextSource(doc as never);
    usePdfTextStore.getState().setSource(source);
    await source.ready(1);
    const reader = mountReader(3);
    expect(reader.startFromPage(1)?.sentence).toBe("Page one ends here.");
    const prepared = reader.prepareNextSentence();
    release();
    await prepared;
    expect(reader.advanceToNextSentence()?.sentence).toBe("Page three starts.");
  });
});

import { fontDataFromObject } from "@uxie/shared/lib/reflow/extract";
import { reconstructPage, regionText } from "@uxie/shared/lib/reflow/reconstruct";
import { createReflowSource, type ReflowSource } from "@uxie/shared/lib/reflow/source";
import type { ReflowPage, TextRegion } from "@uxie/shared/lib/reflow/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { getDocument } from "pdfjs-dist/legacy/build/pdf";
import { beforeAll, describe, expect, it } from "vitest";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(resolve(__dirname, "fixtures/reflow", name)));

type Loaded = { source: ReflowSource; text: (page: number) => Promise<string[]> };

const load = async (name: string): Promise<Loaded> => {
  const doc = await getDocument({ data: fixture(name), verbosity: 0, fontExtraProperties: true }).promise;
  const source = createReflowSource(doc);
  const text = async (pageNumber: number) => {
    const [page, input] = await Promise.all([source.page(pageNumber), source.pageInput(pageNumber)]);
    if (page.kind !== "reflow") return [];
    const strs = new Map(input.items.map((i) => [i.index, i.str]));
    return page.regions
      .filter((r): r is TextRegion => r.kind === "text")
      .map((r) => regionText(r, (i) => strs.get(i)!));
  };
  return { source, text };
};

const reflowed = (page: ReflowPage) => {
  if (page.kind !== "reflow") throw new Error(`page ${page.pageNumber} kept: ${page.reason}`);
  return page;
};

describe("reflow reconstruction on real PDFs", { timeout: 60_000 }, () => {
  let scotus: Loaded;
  let udhr: Loaded;
  let nist: Loaded;
  let tracemonkey: Loaded;

  beforeAll(async () => {
    [scotus, udhr, nist, tracemonkey] = await Promise.all([
      load("scotus-opinion.pdf"),
      load("udhr-french.pdf"),
      load("nist-cswp.pdf"),
      load("tracemonkey-two-column.pdf"),
    ]);
  }, 60_000);

  it("removes running headers and page numbers but keeps body text that mentions them", async () => {
    const pages = await Promise.all([10, 11, 12, 13, 20].map((n) => scotus.text(n)));
    for (const regions of pages) {
      expect(regions.some((t) => /^Cite as:/.test(t))).toBe(false);
      expect(regions.some((t) => t === "Opinion of the Court")).toBe(false);
      expect(regions.some((t) => /^\d+$/.test(t.trim()))).toBe(false);
    }
    const all = (await Promise.all(Array.from({ length: 40 }, (_, i) => scotus.text(i + 1)))).flat();
    expect(all.some((t) => t.includes("delivered the opinion of the Court"))).toBe(true);
  });

  it("does not turn wrapped citations into list items", async () => {
    for (let n = 1; n <= 40; n++) {
      const page = await scotus.source.page(n);
      if (page.kind !== "reflow") continue;
      const input = await scotus.source.pageInput(n);
      const strs = new Map(input.items.map((i) => [i.index, i.str]));
      for (const r of page.regions) {
        if (r.kind !== "text" || r.role !== "list-item") continue;
        expect(regionText(r, (i) => strs.get(i)!)).toMatch(/^\s*(?:[-•]|\(?[a-z0-9]{1,3}[.)])\s/);
      }
    }
  });

  it("joins lines by the document's own leading, not a fixed gap", async () => {
    const regions = await udhr.text(8);
    const second = regions.find((t) => t.startsWith("2. Dans l'exercice"));
    expect(second).toBeDefined();
    expect(second).toContain("société démocratique.");
    expect(regions).toContain("Article 30");
  });

  it("keeps every UDHR article heading", async () => {
    const all = (await Promise.all(Array.from({ length: 8 }, (_, i) => udhr.text(i + 1)))).flat();
    for (let n = 2; n <= 30; n++) expect(all.join(" ")).toContain(`Article ${n}`);
    for (const n of [2, 5, 13, 29, 30]) expect(all).toContain(`Article ${n}`);
  });

  it("keeps a real line-end hyphen and joins a broken word only on evidence", async () => {
    const page = reflowed(await nist.source.page(2));
    expect(page.hyphens).toContainEqual({ tail: "high", head: "level", decision: "kept" });
    const text = (await nist.text(2)).join(" ");
    expect(text).toContain("high-level cybersecurity outcomes");

    const scotusPages = await Promise.all(Array.from({ length: 40 }, (_, i) => scotus.source.page(i + 1)));
    const joins = scotusPages.flatMap((p) => (p.kind === "reflow" ? p.hyphens : []));
    expect(joins).toContainEqual({ tail: "bibli", head: "cal", decision: "word-evidence" });
    const all = (await Promise.all(Array.from({ length: 40 }, (_, i) => scotus.text(i + 1)))).flat().join(" ");
    expect(all).toContain("contradicts biblical truth");
    expect(all).not.toContain("bibli-cal");
  });

  it("reads two columns left then right, with figures as crops", async () => {
    const page = reflowed(await tracemonkey.source.page(1));
    const text = (await tracemonkey.text(1)).join("\n");
    const abstract = text.indexOf("Dynamic languages such as JavaScript are more difficult");
    const intro = text.indexOf("1. Introduction");
    const rightColumn = text.indexOf("Compilers for statically typed languages");
    expect(abstract).toBeGreaterThanOrEqual(0);
    expect(intro).toBeGreaterThan(abstract);
    expect(rightColumn).toBeGreaterThan(intro);
    expect(text).toContain("Trace-based Just-in-Time Type Specialization for Dynamic Languages");
    expect(page.regions.filter((r) => r.kind === "crop").length).toBe(0);

    const figurePages = await Promise.all([2, 3, 4].map((n) => tracemonkey.source.page(n)));
    const crops = figurePages.flatMap((p) => (p.kind === "reflow" ? p.regions.filter((r) => r.kind === "crop") : []));
    expect(crops.length).toBeGreaterThan(0);
  });

  it("anchors every run to a distinct slice of a pdf.js text item", async () => {
    for (const { source } of [scotus, nist, tracemonkey]) {
      for (const n of [1, 2, 3]) {
        const page = await source.page(n);
        if (page.kind !== "reflow") continue;
        const input = await source.pageInput(n);
        const strs = new Map(input.items.map((i) => [i.index, i.str]));
        const seen = new Set<number>();
        for (const r of page.regions) {
          if (r.kind !== "text") continue;
          for (const run of r.runs) {
            const str = strs.get(run.itemIndex);
            expect(str).toBeDefined();
            expect(run.start).toBeGreaterThanOrEqual(0);
            expect(run.end).toBeLessThanOrEqual(str!.length);
            expect(seen.has(run.itemIndex)).toBe(false);
            seen.add(run.itemIndex);
          }
        }
      }
    }
  });

  it("detects code only from the font's FixedPitch flag", async () => {
    const pages = await Promise.all([1, 2, 3, 4, 5].map((n) => tracemonkey.source.page(n)));
    const code = pages.flatMap((p) => (p.kind === "reflow" ? p.regions.filter((r) => r.kind === "crop" && r.role === "code") : []));
    expect(code.length).toBeGreaterThan(0);
    const inputs = await Promise.all([1, 2, 3, 4, 5].map((n) => tracemonkey.source.pageInput(n)));
    for (const input of inputs) for (const item of input.items) expect(item.monospace).not.toBeNull();
  });

  it("keeps a page whose text has no real font extent instead of guessing one", async () => {
    const [input, profile] = await Promise.all([nist.source.pageInput(2), nist.source.profile()]);
    expect(reconstructPage(input, profile).kind).toBe("reflow");
    const target = input.items.findIndex((i) => i.horizontal && !i.artifact && i.direction !== "ttb" && i.str.trim());
    const items = input.items.map((item, i) => (i === target ? { ...item, metricsKnown: false } : item));
    expect(reconstructPage({ ...input, items }, profile)).toMatchObject({ kind: "keep", reason: "unknown-font-metrics" });
  });

  it("refuses pages it cannot reflow faithfully", async () => {
    const arabic = await load("rtl-arabic-wikipedia.pdf");
    expect(await arabic.source.page(1)).toMatchObject({ kind: "keep", reason: "right-to-left" });
    const scan = await load("scan-ocr-nasa.pdf");
    expect(await scan.source.page(1)).toMatchObject({ kind: "keep", reason: "scanned" });
  });
});

describe("font data from pdf.js font objects", () => {
  it("takes the vertical extent from the declared FontBBox", () => {
    const data = fontDataFromObject({ isMonospace: false, bbox: [0, -213, 479, 693], fontMatrix: [0.001, 0, 0, 0.001, 0, 0] });
    expect(data.monospace).toBe(false);
    expect(data.extent?.ascent).toBeCloseTo(0.693);
    expect(data.extent?.descent).toBeCloseTo(-0.213);
  });

  it("reports unknown when the data is missing rather than inventing it", () => {
    expect(fontDataFromObject(undefined)).toEqual({ monospace: null, extent: null });
    expect(fontDataFromObject({ name: "Times-Roman", fontMatrix: [0.001, 0, 0, 0.001, 0, 0] })).toEqual({
      monospace: null,
      extent: null,
    });
    expect(
      fontDataFromObject({ isType3Font: true, isMonospace: true, bbox: [34, 120, 966, -880], fontMatrix: [0.001, 0, 0, -0.001, 0, 0] }),
    ).toEqual({ monospace: true, extent: null });
  });
});

describe("reflow profile", { timeout: 60_000 }, () => {
  it("builds from the sample pages that load and retries after a total failure", async () => {
    const doc = await getDocument({ data: fixture("udhr-french.pdf"), verbosity: 0, fontExtraProperties: true }).promise;
    let failAll = true;
    const flaky = {
      numPages: doc.numPages,
      getPage: (n: number) =>
        failAll || n === 2 ? Promise.reject(new Error(`page ${n} unreadable`)) : doc.getPage(n),
    } as unknown as PDFDocumentProxy;
    const source = createReflowSource(flaky);
    await expect(source.profile()).rejects.toThrow();
    failAll = false;
    expect((await source.profile()).bodyFontSize).toBeGreaterThan(0);
  });
});

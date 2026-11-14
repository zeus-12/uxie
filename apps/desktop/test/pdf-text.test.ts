import { readFile } from "fs/promises";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { chunkPdfPages } from "@uxie/shared/lib/embeddings";
import { extractPdfPagesFromBytes } from "../src/main/pdf-text";

const DEMO_PDF = join(__dirname, "../../web/public/demo.pdf");

describe("page-aware PDF extraction", () => {
  it("keeps text and chunks attached to their real pages", async () => {
    const pages = await extractPdfPagesFromBytes(await readFile(DEMO_PDF));
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ pageNumber: 1 });
    expect(pages[1]).toMatchObject({ pageNumber: 2 });
    expect(pages[0]!.text).toContain("Understanding fades");
    expect(pages[1]!.text).toContain("spaced repetition");

    const chunks = await chunkPdfPages(pages);
    expect(chunks.length).toBeGreaterThan(1);
    expect(
      chunks.every((chunk) => chunk.pageNumber === 1 || chunk.pageNumber === 2),
    ).toBe(true);
    expect(
      chunks.some(
        (chunk) =>
          chunk.pageNumber === 1 &&
          chunk.pageContent.includes("Understanding fades"),
      ),
    ).toBe(true);
    expect(
      chunks.some(
        (chunk) =>
          chunk.pageNumber === 2 &&
          chunk.pageContent.includes("spaced repetition"),
      ),
    ).toBe(true);
  });
});

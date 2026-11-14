import {
  findBlockNearestPoint,
  reconstructPage,
  type ExtractedPage,
  type ExtractedTextItem,
} from "@uxie/shared/experimental/reflow/model";
import { describe, expect, it } from "vitest";

type ItemInput = {
  text: string;
  x: number;
  baseline: number;
  width?: number;
  fontSize?: number;
};

const makePage = (
  inputs: ItemInput[],
  diagnostics: Partial<ExtractedPage["diagnostics"]> = {},
): ExtractedPage => {
  let pageText = "";
  const items: ExtractedTextItem[] = inputs.map((input, sourceIndex) => {
    if (pageText) pageText += " ";
    const textStart = pageText.length;
    pageText += input.text;
    const fontSize = input.fontSize ?? 10;
    return {
      sourceIndex,
      textStart,
      textEnd: pageText.length,
      str: input.text,
      direction: "ltr",
      fontName: "body",
      fontFamily: "sans-serif",
      fontSize,
      hasEol: true,
      markedContentId: null,
      baseline: input.baseline,
      rect: {
        x: input.x,
        y: input.baseline - fontSize * 0.8,
        width: input.width ?? input.text.length * fontSize * 0.45,
        height: fontSize,
      },
    };
  });
  return {
    pageNumber: 1,
    width: 612,
    height: 792,
    pageText,
    items,
    graphicRegions: [],
    diagnostics: {
      combinedItemCount: items.length,
      uncombinedItemCount: items.length,
      annotationCount: 0,
      operatorCount: 0,
      vectorPaintCount: 0,
      structTreeRoles: [],
      markedContentItemCount: 0,
      ...diagnostics,
    },
  };
};

describe("experimental PDF reflow reconstruction", () => {
  it("reconstructs a heading and ordinary single-column paragraphs", () => {
    const page = makePage([
      { text: "Reading Well", x: 70, baseline: 70, fontSize: 20 },
      {
        text: "A normal first line that belongs to the opening paragraph.",
        x: 70,
        baseline: 115,
      },
      {
        text: "Its second line should stay with that paragraph and remain selectable.",
        x: 70,
        baseline: 127,
      },
      {
        text: "A separate paragraph starts after a visible vertical gap on the page.",
        x: 70,
        baseline: 165,
      },
    ]);

    const result = reconstructPage(page);

    expect(result.kind).toBe("reflowed");
    if (result.kind !== "reflowed") return;
    expect(result.blocks.map((block) => block.kind)).toEqual([
      "heading",
      "paragraph",
      "paragraph",
    ]);
    expect(
      result.blocks[1]?.kind === "paragraph" && result.blocks[1].text,
    ).toContain("second line");
    expect(result.blocks.every((block) => block.anchor.pageNumber === 1)).toBe(
      true,
    );
    expect(result.blocks.every((block) => block.anchor.rects.length > 0)).toBe(
      true,
    );
  });

  it("reads a two-column page down the left column before the right", () => {
    const inputs: ItemInput[] = [
      {
        text: "A Two Column Paper",
        x: 55,
        baseline: 55,
        width: 500,
        fontSize: 18,
      },
    ];
    for (let row = 0; row < 5; row += 1) {
      inputs.push(
        {
          text: `Left column sentence ${row + 1} continues the left argument.`,
          x: 55,
          baseline: 100 + row * 12,
          width: 220,
        },
        {
          text: `Right column sentence ${
            row + 1
          } continues the right argument.`,
          x: 330,
          baseline: 100 + row * 12,
          width: 220,
        },
      );
    }
    const result = reconstructPage(makePage(inputs));

    expect(result.kind).toBe("reflowed");
    if (result.kind !== "reflowed") return;
    expect(result.diagnostics.detectedColumns).toBe(2);
    const text = result.blocks.map((block) =>
      block.kind === "figure" ? block.caption ?? "" : block.text,
    );
    expect(text[1]).toContain("Left column sentence 5");
    expect(text[2]).toMatch(/^Right column sentence 1/);
  });

  it("falls back instead of flattening a repeated table grid", () => {
    const inputs: ItemInput[] = [];
    for (let row = 0; row < 5; row += 1) {
      inputs.push(
        { text: `Row ${row + 1}`, x: 50, baseline: 90 + row * 22, width: 45 },
        { text: `${row + 4}`, x: 210, baseline: 90 + row * 22, width: 20 },
        { text: `${90 - row}%`, x: 370, baseline: 90 + row * 22, width: 35 },
      );
    }

    const result = reconstructPage(makePage(inputs));

    expect(result.kind).toBe("fallback");
    if (result.kind !== "fallback") return;
    expect(result.reason).toBe("table-grid");
    expect(result.anchor.boundingRect).toEqual({
      x: 0,
      y: 0,
      width: 612,
      height: 792,
    });
  });

  it("classifies an image-only scanned page as unsupported", () => {
    const result = reconstructPage(makePage([]));
    expect(result.kind).toBe("fallback");
    if (result.kind !== "fallback") return;
    expect(result.reason).toBe("no-text-layer");
  });

  it("falls back when a long line looks like a broken font mapping", () => {
    const result = reconstructPage(
      makePage([
        {
          text: "=<6>?J+B:F>*:</+>?7-<#0(1923# =<6>?J+-?7:,A+,5*/#0(1$23# =<6>?J+<:J,F5-*#0(1(23# =<6>?J+@:=<:#0(1C23#",
          x: 50,
          baseline: 100,
          width: 500,
        },
      ]),
    );

    expect(result.kind).toBe("fallback");
    if (result.kind !== "fallback") return;
    expect(result.reason).toBe("corrupt-font-mapping");
  });

  it("maps an original-page y coordinate to the nearest anchored block", () => {
    const page = makePage([
      { text: "First section", x: 70, baseline: 80, fontSize: 18 },
      {
        text: "The first paragraph has enough text to qualify as readable body content.",
        x: 70,
        baseline: 112,
      },
      { text: "Second section", x: 70, baseline: 310, fontSize: 18 },
      {
        text: "The second paragraph has enough text to qualify as readable body content.",
        x: 70,
        baseline: 342,
      },
    ]);
    const reconstructed = reconstructPage(page);
    const document = {
      qualification: "supported" as const,
      pages: [reconstructed],
      supportedPageCount: 1,
      fallbackPageCount: 0,
    };

    const nearest = findBlockNearestPoint(document, 1, 330);

    expect(nearest?.kind).toBe("paragraph");
    expect(nearest?.kind === "paragraph" && nearest.text).toContain(
      "second paragraph",
    );
  });
});

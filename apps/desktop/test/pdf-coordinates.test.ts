import { describe, expect, it } from "vitest";
import type { RectInput } from "@uxie/shared/schema";
import {
  scaledRectToPdfRectangle,
  type PdfViewport,
} from "@uxie/shared/lib/annotated-pdf";

const rect = (input: Partial<RectInput> = {}): RectInput => ({
  x1: 200,
  y1: 100,
  x2: 600,
  y2: 500,
  width: 1600,
  height: 1200,
  pageNumber: 1,
  ...input,
});

describe("scaledRectToPdfRectangle", () => {
  it("removes the zoom used when the rectangle was stored", () => {
    const viewport: PdfViewport = {
      width: 800,
      height: 600,
      convertToPdfPoint: (x, y) => [x, 600 - y],
    };

    expect(scaledRectToPdfRectangle(rect(), viewport)).toEqual({
      x: 100,
      y: 350,
      width: 200,
      height: 200,
    });
  });

  it.each([
    {
      rotation: 0,
      viewport: {
        width: 600,
        height: 800,
        convertToPdfPoint: (x: number, y: number) => [x + 10, 820 - y],
      },
      expected: {
        x: 85,
        y: 486.6666666666667,
        width: 150,
        height: 266.66666666666663,
      },
    },
    {
      rotation: 90,
      viewport: {
        width: 800,
        height: 600,
        convertToPdfPoint: (x: number, y: number) => [y + 10, x + 20],
      },
      expected: { x: 60, y: 120, width: 200, height: 200 },
    },
    {
      rotation: 180,
      viewport: {
        width: 600,
        height: 800,
        convertToPdfPoint: (x: number, y: number) => [610 - x, y + 20],
      },
      expected: {
        x: 385,
        y: 86.66666666666667,
        width: 150,
        height: 266.66666666666663,
      },
    },
    {
      rotation: 270,
      viewport: {
        width: 800,
        height: 600,
        convertToPdfPoint: (x: number, y: number) => [610 - y, 820 - x],
      },
      expected: { x: 360, y: 520, width: 200, height: 200 },
    },
  ])("handles a $rotation° rotated crop box", ({ viewport, expected }) => {
    const converted = scaledRectToPdfRectangle(rect(), viewport);
    expect(converted.x).toBeCloseTo(expected.x);
    expect(converted.y).toBeCloseTo(expected.y);
    expect(converted.width).toBeCloseTo(expected.width);
    expect(converted.height).toBeCloseTo(expected.height);
  });

  it("rejects geometry without usable stored page dimensions", () => {
    const viewport: PdfViewport = {
      width: 600,
      height: 800,
      convertToPdfPoint: (x, y) => [x, y],
    };

    expect(() =>
      scaledRectToPdfRectangle(rect({ width: 0 }), viewport),
    ).toThrow("invalid page dimensions");
  });
});

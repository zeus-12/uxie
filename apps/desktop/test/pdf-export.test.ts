import { existsSync } from "fs";
import { mkdtemp, readFile, readdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  degrees,
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
} from "pdf-lib";
import { getDocument as loadPdfJsDocument } from "pdfjs-dist/legacy/build/pdf";
import { describe, expect, it } from "vitest";
import {
  ANNOTATED_PDF_STYLE,
  createAnnotatedPdf,
  type AnnotatedPdfHighlight,
} from "@uxie/shared/lib/annotated-pdf";
import type {
  Cordinate,
  HighlightWithRects,
  RectInput,
} from "@uxie/shared/schema";
import { saveAnnotatedPdf } from "../src/main/pdf-export";

function coordinate(
  input: RectInput,
  relation: "bounding" | "rectangle",
): Cordinate {
  return {
    id: `${relation}-${input.pageNumber ?? 0}`,
    x1: input.x1,
    y1: input.y1,
    x2: input.x2,
    y2: input.y2,
    width: input.width,
    height: input.height,
    pageNumber: input.pageNumber ?? null,
    highlightedRectangleId: relation === "rectangle" ? "highlight" : null,
    highlightedBoundingRectangleId:
      relation === "bounding" ? "highlight" : null,
  };
}

function textHighlight(rectangle: RectInput): HighlightWithRects {
  return {
    id: "text-highlight",
    type: "TEXT",
    documentId: "document",
    createdAt: new Date(0),
    pageNumber: rectangle.pageNumber ?? null,
    imageUrl: null,
    boundingRectangle: coordinate(rectangle, "bounding"),
    rectangles: [coordinate(rectangle, "rectangle")],
  };
}

function areaHighlight(rectangle: RectInput): HighlightWithRects {
  return {
    id: "area-highlight",
    type: "IMAGE",
    documentId: "document",
    createdAt: new Date(0),
    pageNumber: rectangle.pageNumber ?? null,
    imageUrl: "uxie-pdf://image/document/image",
    boundingRectangle: coordinate(rectangle, "bounding"),
    rectangles: [],
  };
}

function exportHighlight(highlight: HighlightWithRects): AnnotatedPdfHighlight {
  return {
    position: {
      pageNumber: highlight.pageNumber,
      boundingRect: highlight.boundingRectangle,
      rects: highlight.rectangles,
    },
  };
}

async function sourcePdf(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([320, 500]);
  first.setCropBox(20, 30, 240, 400);
  first.setRotation(degrees(90));
  first.drawText("Selectable source text", { x: 50, y: 250, font, size: 14 });

  const link = document.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [50, 240, 190, 265],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFString.of("https://example.com"),
    },
  });
  const linkRef = document.context.register(link);
  first.node.set(PDFName.of("Annots"), document.context.obj([linkRef]));

  const second = document.addPage([841.89, 595.28]);
  second.setRotation(degrees(270));
  return document.save();
}

const textRect: RectInput = {
  x1: 80,
  y1: 120,
  x2: 360,
  y2: 170,
  width: 800,
  height: 480,
  pageNumber: 1,
};

const areaRect: RectInput = {
  x1: 100,
  y1: 160,
  x2: 420,
  y2: 440,
  width: 1190.56,
  height: 1683.78,
  pageNumber: 2,
};

describe("annotated PDF export", () => {
  it("adds vector highlights while preserving text, links and page geometry", async () => {
    const source = await sourcePdf();
    const original = new Uint8Array(source);
    const output = await createAnnotatedPdf(source, [
      exportHighlight(textHighlight(textRect)),
      exportHighlight(areaHighlight(areaRect)),
    ]);

    expect(source).toEqual(original);
    expect(output).not.toEqual(source);

    const loaded = await PDFDocument.load(output);
    expect(loaded.getPageCount()).toBe(2);
    expect(loaded.getPage(0).getSize()).toEqual({ width: 320, height: 500 });
    expect(loaded.getPage(0).getCropBox()).toEqual({
      x: 20,
      y: 30,
      width: 240,
      height: 400,
    });
    expect(loaded.getPage(0).getRotation().angle).toBe(90);
    expect(loaded.getPage(1).getSize().width).toBeCloseTo(841.89);
    expect(loaded.getPage(1).getSize().height).toBeCloseTo(595.28);
    expect(loaded.getPage(1).getRotation().angle).toBe(270);

    const loadingTask = loadPdfJsDocument({
      data: new Uint8Array(output),
    });
    const pdfJsDocument = await loadingTask.promise;
    try {
      const page = await pdfJsDocument.getPage(1);
      const text = await page.getTextContent();
      expect(
        text.items
          .flatMap((item) => ("str" in item ? [item.str] : []))
          .join(" "),
      ).toContain("Selectable source text");

      const annotations = await page.getAnnotations();
      expect(
        annotations.some((annotation) => annotation.subtype === "Link"),
      ).toBe(true);
    } finally {
      await pdfJsDocument.destroy();
    }
  });

  it("uses the reader's highlight colors at full strength", () => {
    expect(ANNOTATED_PDF_STYLE).toEqual({
      textFill: [255, 226, 143],
      areaFill: [252, 232, 151],
      areaBorder: [51, 51, 51],
    });
  });

  it("writes the export without changing the stored source", async () => {
    const root = await mkdtemp(join(tmpdir(), "uxie-export-"));
    const sourcePath = join(root, "document.pdf");
    const destinationPath = join(root, "annotated.pdf");
    const source = await sourcePdf();
    await writeFile(sourcePath, source);

    await expect(
      saveAnnotatedPdf({
        highlights: [textHighlight(textRect)],
        sourcePath,
        destinationPath,
      }),
    ).resolves.toEqual({ status: "exported" });

    expect(new Uint8Array(await readFile(sourcePath))).toEqual(source);
    expect(existsSync(destinationPath)).toBe(true);
    await expect(
      PDFDocument.load(await readFile(destinationPath)),
    ).resolves.toBeDefined();
  });

  it("does no file work when the save dialog is cancelled", async () => {
    const root = await mkdtemp(join(tmpdir(), "uxie-export-cancel-"));

    await expect(
      saveAnnotatedPdf({
        highlights: [],
        sourcePath: join(root, "missing-source.pdf"),
        destinationPath: null,
      }),
    ).resolves.toEqual({ status: "cancelled" });

    expect(await readdir(root)).toEqual([]);
  });

  it("refuses to overwrite Uxie's stored source", async () => {
    const root = await mkdtemp(join(tmpdir(), "uxie-export-source-"));
    const sourcePath = join(root, "document.pdf");
    await writeFile(sourcePath, await sourcePdf());

    await expect(
      saveAnnotatedPdf({
        highlights: [],
        sourcePath,
        destinationPath: sourcePath,
      }),
    ).rejects.toThrow("original PDF stays unchanged");
  });
});

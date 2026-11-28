import { existsSync } from "fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  symlink,
  writeFile,
} from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import {
  degrees,
  PDFDocument,
  PDFDict,
  PDFName,
  PDFString,
  StandardFonts,
} from "pdf-lib";
import { getDocument as loadPdfJsDocument } from "pdfjs-dist/legacy/build/pdf";
import { describe, expect, it } from "vitest";
import {
  HIGHLIGHT_EXPORT_RGB,
  createAnnotatedPdf,
  type AnnotatedPdfHighlight,
} from "@uxie/shared/lib/annotated-pdf";
import type {
  Cordinate,
  HighlightWithRects,
  RectInput,
} from "@uxie/shared/schema";
import { saveAnnotatedPdf } from "../src/main/pdf-export";

async function annotate(
  source: Uint8Array,
  highlights: AnnotatedPdfHighlight[],
): Promise<Uint8Array> {
  const pdfJsDocument = await loadPdfJsDocument({
    data: new Uint8Array(source),
  }).promise;
  try {
    return await createAnnotatedPdf(source, highlights, pdfJsDocument);
  } finally {
    await pdfJsDocument.destroy();
  }
}

function expectViewportRect(
  viewport: { convertToViewportRectangle: (rect: number[]) => number[] },
  pdfRect: number[],
  expected: number[],
) {
  const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(pdfRect);
  const actual = [
    Math.min(x1, x2),
    Math.min(y1, y2),
    Math.max(x1, x2),
    Math.max(y1, y2),
  ];
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index]));
}

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
    color: "green",
    selectedText: "Selectable source text",
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
    color: "yellow",
    selectedText: null,
    imageUrl: "uxie-pdf://image/document/image",
    boundingRectangle: coordinate(rectangle, "bounding"),
    rectangles: [],
  };
}

function exportHighlight(highlight: HighlightWithRects): AnnotatedPdfHighlight {
  return {
    id: highlight.id,
    color: highlight.color,
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
    const output = await annotate(source, [
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

    const pdfJsDocument = await loadPdfJsDocument({
      data: new Uint8Array(output),
    }).promise;
    try {
      const first = await pdfJsDocument.getPage(1);
      const text = await first.getTextContent();
      expect(
        text.items
          .flatMap((item) => ("str" in item ? [item.str] : []))
          .join(" "),
      ).toContain("Selectable source text");

      const firstAnnotations = await first.getAnnotations();
      expect(firstAnnotations.map((a) => a.subtype).sort()).toEqual([
        "Highlight",
        "Link",
      ]);
      const highlight = firstAnnotations.find((a) => a.subtype === "Highlight");
      expect(highlight.color).toEqual(
        new Uint8ClampedArray(HIGHLIGHT_EXPORT_RGB.green),
      );
      expectViewportRect(
        first.getViewport({ scale: 1 }),
        highlight.rect,
        [40, 60, 180, 85],
      );

      const second = await pdfJsDocument.getPage(2);
      const [area] = await second.getAnnotations();
      expect(area.subtype).toBe("Square");
      expect(area.color).toEqual(
        new Uint8ClampedArray(HIGHLIGHT_EXPORT_RGB.yellow),
      );
      expectViewportRect(
        second.getViewport({ scale: 1 }),
        area.rect,
        [50, 80, 210, 220],
      );
    } finally {
      await pdfJsDocument.destroy();
    }
  });

  it("splits a highlight that crosses pages into one annotation per page", async () => {
    const output = await annotate(await sourcePdf(), [
      {
        id: "spanning",
        color: "blue",
        position: {
          pageNumber: 1,
          rects: [textRect, { ...areaRect, pageNumber: 2 }],
        },
      },
    ]);
    const loaded = await PDFDocument.load(output);
    const subtypes = (pageIndex: number) =>
      (loaded.getPage(pageIndex).node.Annots()?.asArray() ?? []).map((ref) =>
        loaded.context.lookup(ref, PDFDict).get(PDFName.of("Subtype")),
      );
    expect(subtypes(0)).toContainEqual(PDFName.of("Highlight"));
    expect(subtypes(1)).toEqual([PDFName.of("Highlight")]);
  });

  it("exports an unchanged-looking copy when there are no highlights", async () => {
    const output = await annotate(await sourcePdf(), []);
    const loaded = await PDFDocument.load(output);
    expect(loaded.getPage(1).node.Annots()).toBeUndefined();
  });

  it("writes the export without changing the stored source", async () => {
    const root = await mkdtemp(join(tmpdir(), "uxie-export-"));
    await mkdir(join(root, "library"));
    const sourcePath = join(root, "library", "document.pdf");
    const destinationPath = join(root, "annotated.pdf");
    const source = await sourcePdf();
    await writeFile(sourcePath, source);

    await expect(
      saveAnnotatedPdf({
        highlights: [textHighlight(textRect)],
        sourcePath,
        libraryRoot: join(root, "library"),
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
        libraryRoot: root,
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
        libraryRoot: root,
        destinationPath: sourcePath,
      }),
    ).rejects.toThrow("outside Uxie's library");
  });

  it("refuses the library folder reached through a symlink or other casing", async () => {
    const root = await mkdtemp(join(tmpdir(), "uxie-export-alias-"));
    const library = join(root, "Library");
    await mkdir(library);
    const sourcePath = join(library, "document.pdf");
    const source = await sourcePdf();
    await writeFile(sourcePath, source);
    await symlink(library, join(root, "alias"));

    for (const destinationPath of [
      join(root, "alias", "document.pdf"),
      join(root, "LIBRARY", "Document.PDF"),
    ]) {
      if (!existsSync(dirname(destinationPath))) continue;
      await expect(
        saveAnnotatedPdf({
          highlights: [],
          sourcePath,
          libraryRoot: library,
          destinationPath,
        }),
      ).rejects.toThrow("outside Uxie's library");
    }
    expect(new Uint8Array(await readFile(sourcePath))).toEqual(source);
  });

  it("refuses every folder inside the library, not only the document's own", async () => {
    const root = await mkdtemp(join(tmpdir(), "uxie-export-library-"));
    const library = join(root, "documents");
    const sourcePath = join(library, "doc-a", "document.pdf");
    await mkdir(join(library, "doc-a"), { recursive: true });
    await mkdir(join(library, "doc-b"));
    await writeFile(sourcePath, await sourcePdf());

    for (const destinationPath of [
      join(library, "doc-b", "document.pdf"),
      join(library, "exported.pdf"),
    ]) {
      await expect(
        saveAnnotatedPdf({
          highlights: [],
          sourcePath,
          libraryRoot: library,
          destinationPath,
        }),
      ).rejects.toThrow("outside Uxie's library");
      expect(existsSync(destinationPath)).toBe(false);
    }
  });
});

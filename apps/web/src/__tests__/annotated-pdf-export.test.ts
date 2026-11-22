import { prepareAnnotatedPdfDownload } from "@/lib/annotated-pdf-export";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf";
import { describe, expect, it, vi } from "vitest";

describe("prepareAnnotatedPdfDownload", () => {
  it("annotates the PDF the reader already loaded without fetching it", async () => {
    const data = new Uint8Array(
      readFileSync(resolve(__dirname, "../../public/demo.pdf")),
    );
    const pdfDocument = await getDocument({ data }).promise;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { blob, filename } = await prepareAnnotatedPdfDownload({
      highlights: [
        {
          id: "highlight-1",
          position: {
            pageNumber: 1,
            boundingRect: null,
            rects: [
              { x1: 100, y1: 100, x2: 300, y2: 120, width: 800, height: 1000 },
            ],
          },
        },
      ],
      pdfDocument,
      title: "Research.pdf",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(filename).toBe("Research annotated.pdf");
    expect(blob.type).toBe("application/pdf");

    const exported = await getDocument({
      data: new Uint8Array(await blob.arrayBuffer()),
    }).promise;
    const annotations = await (await exported.getPage(1)).getAnnotations();
    expect(annotations.map((a: { subtype: string }) => a.subtype)).toContain(
      "Highlight",
    );
    await Promise.all([pdfDocument.destroy(), exported.destroy()]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAnnotatedPdf: vi.fn(),
}));

vi.mock("@uxie/shared/lib/annotated-pdf", async (importOriginal) => ({
  ...(await importOriginal()),
  createAnnotatedPdf: mocks.createAnnotatedPdf,
}));

import { prepareAnnotatedPdfDownload } from "@/lib/annotated-pdf-export";

describe("prepareAnnotatedPdfDownload", () => {
  beforeEach(() => {
    mocks.createAnnotatedPdf.mockReset();
  });

  it("exports from the loaded PDF without fetching or uploading it", async () => {
    const sourceBytes = new Uint8Array([1, 2, 3]);
    const exportedBytes = new Uint8Array([37, 80, 68, 70]);
    const pdfDocument = {
      numPages: 1,
      getData: vi.fn().mockResolvedValue(sourceBytes),
      getPage: vi.fn(),
    };
    const highlights = [
      {
        position: {
          pageNumber: 1,
          rects: [
            {
              x1: 1,
              y1: 2,
              x2: 3,
              y2: 4,
              width: 10,
              height: 10,
            },
          ],
        },
      },
    ];
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    mocks.createAnnotatedPdf.mockResolvedValue(exportedBytes);

    const result = await prepareAnnotatedPdfDownload({
      highlights,
      pdfDocument,
      title: "Research.pdf",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(pdfDocument.getData).toHaveBeenCalledOnce();
    expect(mocks.createAnnotatedPdf).toHaveBeenCalledWith(
      sourceBytes,
      highlights,
      { viewportDocument: pdfDocument },
    );
    expect(result.filename).toBe("Research annotated.pdf");
    expect(result.blob.type).toBe("application/pdf");
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(
      exportedBytes,
    );

    fetchSpy.mockRestore();
  });
});

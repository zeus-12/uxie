import { getDocument } from "pdfjs-dist";
import type { PdfPageText } from "./chat";

// Same pdf.js build and item join as the reader's text layer, so a chunk cut
// from this text can be found again on the rendered page.
export async function extractPdfPages(
  bytes: Uint8Array,
): Promise<PdfPageText[]> {
  const pages: PdfPageText[] = [];
  const pdf = await getDocument({ data: bytes }).promise;
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.flatMap((item) =>
        "str" in item && typeof item.str === "string" ? [item.str] : [],
      );
      pages.push({ pageNumber, text: text.join(" ") });
      page.cleanup();
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}

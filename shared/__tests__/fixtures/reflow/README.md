# Reflow fixtures

Real PDFs for `reflow-reconstruct.test.ts` and `reflow-search.test.ts`, one per layout kind.

- `text.pdf`: single-column text with running headers. Pages 1 and 6–13 of the U.S. Supreme Court slip opinion 303 Creative LLC v. Elenis (2023). U.S. government work.
- `two-column.pdf`: two-column paper with figures. Pages 1–3 of Liu et al., "A ConvNet for the 2020s", arXiv:2201.03545v2 (https://arxiv.org/abs/2201.03545v2). CC BY 4.0, shared under the same licence.
- `french.pdf`: loosely leaded text with a heading per article. Universal Declaration of Human Rights, French text, from the UN OHCHR translation collection, which publishes the translations for free reproduction.
- `rtl.pdf`: right-to-left text. Page 1 of the PDF export of the Arabic Wikipedia article "قطر" (Qatar). CC BY-SA 4.0, Wikipedia contributors, shared under the same licence.
- `ocr.pdf`: scanned page with an OCR text layer. Page 6 of a scanned NASA Technical Reports Server document. U.S. government work.

Page subsets were cut with pdf-lib `copyPages`, which keeps the content streams (and their marked content) unchanged.

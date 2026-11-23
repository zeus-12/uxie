# Reflow fixtures

Real PDFs for `reflow-reconstruct.test.ts` and `reflow-search.test.ts`.

- `scotus-opinion.pdf`: U.S. Supreme Court, 303 Creative LLC v. Elenis (2023), slip opinion. U.S. government work.
- `nist-cswp.pdf`: pages 1–12 of NIST CSWP 29, The NIST Cybersecurity Framework 2.0. U.S. government work.
- `scan-ocr-nasa.pdf`: pages 6–7 of a scanned NASA Technical Reports Server document with an OCR text layer. U.S. government work.
- `udhr-french.pdf`: Universal Declaration of Human Rights, French text, from the UN OHCHR translation collection.
- `rtl-arabic-wikipedia.pdf`: pages 1–2 of an Arabic Wikipedia article PDF export. CC BY-SA 4.0, Wikipedia contributors.
- `tracemonkey-two-column.pdf`: the PDF.js TraceMonkey sample paper from the PDF.js demo corpus.

Page subsets were cut with pdf-lib `copyPages`, which keeps the content streams (and their marked content) unchanged.

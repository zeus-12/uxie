# Reflow fixtures

Real PDFs for `reflow-reconstruct.test.ts` and `reflow-search.test.ts`.

- `scotus-opinion.pdf`: U.S. Supreme Court, 303 Creative LLC v. Elenis (2023), slip opinion. U.S. government work.
- `nist-cswp.pdf`: pages 1–12 of NIST CSWP 29, The NIST Cybersecurity Framework 2.0. U.S. government work.
- `scan-ocr-nasa.pdf`: pages 6–7 of a scanned NASA Technical Reports Server document with an OCR text layer. U.S. government work.
- `udhr-french.pdf`: Universal Declaration of Human Rights, French text, from the UN OHCHR translation collection. OHCHR publishes the UDHR translations for free reproduction.
- `rtl-arabic-wikipedia.pdf`: pages 1–2 of the PDF export of the Arabic Wikipedia article "قطر" (Qatar). CC BY-SA 4.0, Wikipedia contributors; this subset is shared under the same licence.
- `tracemonkey-two-column.pdf`: Gal et al., "Trace-based Just-in-Time Type Specialization for Dynamic Languages", PLDI '09, as redistributed in the PDF.js repository (Apache-2.0) as its demo document (`web/compressed.tracemonkey-pldi-09.pdf`). Copyright of the paper stays with its authors and ACM.

Page subsets were cut with pdf-lib `copyPages`, which keeps the content streams (and their marked content) unchanged.

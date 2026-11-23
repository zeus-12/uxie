# Reflow fixtures

Real PDFs for `reflow-reconstruct.test.ts` and `reflow-search.test.ts`.

- `scotus-opinion.pdf`: U.S. Supreme Court, 303 Creative LLC v. Elenis (2023), slip opinion. U.S. government work.
- `nist-cswp.pdf`: pages 1–12 of NIST CSWP 29, The NIST Cybersecurity Framework 2.0. U.S. government work.
- `scan-ocr-nasa.pdf`: pages 6–7 of a scanned NASA Technical Reports Server document with an OCR text layer. U.S. government work.
- `udhr-french.pdf`: Universal Declaration of Human Rights, French text, from the UN OHCHR translation collection. OHCHR publishes the UDHR translations for free reproduction.
- `rtl-arabic-wikipedia.pdf`: pages 1–2 of the PDF export of the Arabic Wikipedia article "قطر" (Qatar). CC BY-SA 4.0, Wikipedia contributors; this subset is shared under the same licence.
- `convnext-two-column.pdf`: pages 1–4 of Liu et al., "A ConvNet for the 2020s", arXiv:2201.03545v2 (https://arxiv.org/abs/2201.03545v2), CVPR two-column layout. CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), as stated on its arXiv page; this subset is shared under the same licence.

Page subsets were cut with pdf-lib `copyPages`, which keeps the content streams (and their marked content) unchanged.

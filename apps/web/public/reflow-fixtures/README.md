# Reflow prototype fixtures

These files exist only for the isolated `/demo/reflow` research route.

- `two-column-paper.pdf` is the PDF.js TraceMonkey sample paper, from the [PDF.js demo corpus](https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf).
- `headings-and-figure.pdf` is the W3C WCAG tagged-image example associated with [PDF Technique PDF20](https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF20).
- `complex-table.pdf` is the W3C WCAG tagged-table example associated with [PDF Technique PDF6](https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF6).
- `scanned-page.pdf` is an image-only PDF generated locally from Uxie's existing public demo document to exercise the no-text-layer path.
- `pdf.worker.min.js` is the worker bundled by the repository's pinned `pdfjs-dist` 2.16.105 dependency so the prototype is self-contained.

The existing `/demo.pdf` is the single-column corpus item.

# PDF reflow prototype findings

## Prototype boundary

The prototype lives at `/demo/reflow`. It is intentionally isolated from the production reader and runs entirely in the browser. It uses Uxie's existing shared `PdfHighlighter` for the original view and the repository's pinned `pdfjs-dist` 2.16.105 for extraction and rendering. It does not call a server, OCR service, or language model.

The route includes a five-document corpus, an Original/Reflow switch, font-size, line-height, and reading-width controls, page diagnostics, a local-PDF picker, and per-block source buttons. Complex pages remain as rendered PDF pages inside the reflow stream.

## What PDF.js 2.16.105 exposes

`getTextContent()` provides text items with `str`, `dir`, a six-value transform, width, height, `fontName`, and `hasEOL`. Its `styles` map adds ascent, descent, vertical-writing information, and a best-effort font family. Calling it with and without `disableCombineTextItems` is useful diagnostically: the combined form is a better reconstruction input, while a large divergence from the uncombined count exposes how much grouping PDF.js already performed.

The transform and style metrics are sufficient to derive approximate viewport-space baselines and bounding boxes. They are not glyph outlines. `hasEOL` is a useful line-break hint, not a paragraph boundary. Font names are commonly generated identifiers, and font family/size are reliable enough for relative comparisons on a page, not for reproducing the source typography exactly.

`includeMarkedContent` adds begin/end records and marked-content IDs. `getStructTree()` returns a page-level role tree whose content IDs can meet those marked-content IDs. This is valuable when present—for example, a `Table` role is a strong reason to keep the page original—but many ordinary PDFs are untagged, and tags are not consistently detailed enough to be the primary reading-order algorithm.

`getOperatorList()` exposes image and vector-paint operations. The prototype tracks the graphics-state transform around raster-image paint operations, which gives usable figure crops. Vector operators are useful as a complexity signal, but they do not directly provide semantic equations or tables. `getAnnotations()` supplies link/annotation counts; reflow source navigation does not depend on annotation quality.

## Reconstruction results

The reconstruction pipeline groups text items into line bands, splits large horizontal gaps, detects one or two column starts, and reads two-column regions down the left column before the right. Full-width lines divide column regions. It then joins compatible lines into paragraphs, removes line-end hyphenation, and uses relative font size, numbering, page position, and text patterns for headings, lists, captions, and footnotes.

Every output block has a source anchor containing:

- PDF page number;
- combined-text item range;
- normalized page-text offsets;
- exact quote with prefix and suffix context;
- item rectangles and their union in the scale-1 PDF.js viewport;
- an extraction-version string.

The rectangle is the primary navigation target. The quote and offsets make the anchor inspectable and give a recovery path if grouping changes. Offsets are extraction-output offsets, not intrinsic PDF offsets, so they must be versioned.

Observed corpus results:

| Document                       | Result              | Notes                                                                                                                                                                                   |
| ------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two-page single-column article | 2/2 pages reflowed  | Headings, numbered sections, paragraphs, responsive controls, and source jumps work.                                                                                                    |
| Fourteen-page two-column paper | 9/14 pages reflowed | Representative prose pages read left column then right. Code/equation, table-like, and broken-font chart pages fall back. Front-matter author metadata remains noisier than body prose. |
| Tagged page with a figure      | 1/1 page reflowed   | The structure tree exposes `Figure`; the raster image is placed as a selectable-flow figure crop.                                                                                       |
| Tagged complex table           | 0/1 pages reflowed  | The `Table` role and repeated aligned cells trigger original-page fallback.                                                                                                             |
| Image-only scanned page        | 0/1 pages reflowed  | No text items; classified unsupported without attempting OCR.                                                                                                                           |

Reliable today: ordinary single-column prose, representative two-column body prose, relative heading signals, simple lists, bottom-of-page footnotes, raster figures, page attribution, and source navigation.

Not reliable enough to flatten: dense tables, multi-line equations/code diagrams, charts with custom font encodings, arbitrary vector figures, marginalia, more than two columns, vertical or substantially right-to-left writing, and documents whose visible text is only an image. Captions are pattern-based and can be missed. Structure trees improve confidence but are optional and sometimes incomplete.

## Qualification and fallback rules

A page qualifies only when it has a meaningful left-to-right text layer, reconstructable one- or two-column geometry, and no strong complexity signal. The prototype keeps the original page when any of these apply:

- no text layer or fewer than 36 normalized characters;
- more than 4% of characters use an unsupported writing direction;
- a tagged table or at least five repeated table-like rows;
- dense equation/code lines;
- a long suspicious character mapping consistent with a broken embedded chart font;
- many vector paint operations with little text;
- no usable lines or blocks after grouping.

A document is **supported** when at least 60% of its pages qualify, **mixed** when some but fewer than 60% qualify, and **unsupported** when no pages qualify. This label never overrides page-level fallback. Production should initially offer Reflow only for supported documents, allow mixed documents behind an explicit warning, and hide it for unsupported documents.

## Position synchronization

Reflow-to-original uses the clicked block's page and bounding-box origin with the PDF viewer's `XYZ` destination. Original-to-reflow converts the viewer's current PDF coordinate into the scale-1 viewport and chooses the nearest block on that page. This preserves the approximate reading position, not the exact scroll pixel. It remains stable across font size and reading-width changes because the source anchor is independent of reflow layout.

## Production recommendation

Keep the reconstruction model in `shared` as a pure, versioned pipeline and keep PDF.js calls in a thin extraction boundary. The original PDF viewer remains the source of truth. Run a cheap qualification pass before exposing the toggle, then extract pages lazily near the reading position and cache results by PDF fingerprint, page number, PDF.js version, and reconstruction version. Cache only derived client-side data unless product requirements later justify server storage.

Use a discriminated page model: either trusted reflow blocks or an original-page fallback, never partially trusted flattened text. Preserve the multi-part source anchor on every block and instrument fallback reasons before widening eligibility. Structure tags should raise confidence and trigger hard safety rules, while geometry remains the fallback for untagged documents.

Do not add OCR, server reconstruction, or heuristic table/equation flattening in the first production slice. Start with single-column prose and conservative two-column articles, behind an experimental feature flag, and expand qualification only with corpus-backed tests.

## Running the prototype

From the repository root:

```sh
SKIP_ENV_VALIDATION=1 pnpm dev:web
```

Open `http://localhost:3000/demo/reflow`.

Focused verification:

```sh
pnpm --filter @uxie/web test -- reflow-model.test.ts
pnpm typecheck
```

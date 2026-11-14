/**
 * EXPERIMENTAL PROTOTYPE. This route is deliberately separate from Uxie's
 * production reader. It exists to test PDF.js reconstruction and source
 * anchoring against a small, public corpus.
 */
import PdfHighlighter, {
  type HighlighterInstance,
} from "@uxie/shared/components/pdf-reader/pdf-highlighter";
import { Spinner } from "@uxie/shared/components/ui/spinner";
import { extractDocument } from "@uxie/shared/experimental/reflow/extract";
import {
  findBlockNearestPoint,
  reconstructDocument,
  type PdfRect,
  type ReflowBlock,
  type ReflowDocument,
  type SourceAnchor,
} from "@uxie/shared/experimental/reflow/model";
import { AlertTriangle, FlaskConical, Inspect, Upload } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { PDFViewer } from "pdfjs-dist/types/web/pdf_viewer";
import { useCallback, useEffect, useRef, useState } from "react";
import { PdfLoader } from "react-pdf-highlighter";

const WORKER_SRC = "/reflow-fixtures/pdf.worker.min.js";

type Fixture = {
  id: string;
  label: string;
  shape: string;
  url: string;
};

const FIXTURES: Fixture[] = [
  {
    id: "article",
    label: "Single-column article",
    shape: "Expected success",
    url: "/demo.pdf",
  },
  {
    id: "paper",
    label: "Two-column paper",
    shape: "Reading-order test",
    url: "/reflow-fixtures/two-column-paper.pdf",
  },
  {
    id: "figure",
    label: "Tagged figure",
    shape: "Structure and image test",
    url: "/reflow-fixtures/headings-and-figure.pdf",
  },
  {
    id: "table",
    label: "Complex table",
    shape: "Expected page fallback",
    url: "/reflow-fixtures/complex-table.pdf",
  },
  {
    id: "scan",
    label: "Image-only scan",
    shape: "Expected unsupported",
    url: "/reflow-fixtures/scanned-page.pdf",
  },
];

const DEFAULT_FIXTURE = FIXTURES[0]!;

type ViewMode = "original" | "reflow";
type OriginalLocation = {
  pageNumber: number;
  left: number;
  top: number;
};

const focusClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900";
const controlClass = `${focusClass} min-h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-800`;

const messageFrom = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const fallbackLabel = (reason: string) =>
  reason
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const firstAnchor = (document: ReflowDocument): SourceAnchor | null => {
  const firstPage = document.pages[0];
  if (!firstPage) return null;
  return firstPage.kind === "fallback"
    ? firstPage.anchor
    : firstPage.blocks[0]?.anchor ?? null;
};

function PageCanvas({
  document,
  pageNumber,
  crop,
  label,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  crop?: PdfRect;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | null = null;

    const render = async () => {
      const page = await document.getPage(pageNumber);
      if (cancelled) return;
      const scale = 1.6;
      const viewport = page.getViewport({ scale });
      const target = canvasRef.current;
      if (!target) return;
      if (crop) {
        const source = window.document.createElement("canvas");
        source.width = Math.ceil(viewport.width);
        source.height = Math.ceil(viewport.height);
        const sourceContext = source.getContext("2d");
        if (!sourceContext) return;
        task = page.render({ canvasContext: sourceContext, viewport });
        await task.promise;
        if (cancelled) return;
        target.width = Math.max(1, Math.ceil(crop.width * scale));
        target.height = Math.max(1, Math.ceil(crop.height * scale));
        const targetContext = target.getContext("2d");
        if (!targetContext) return;
        targetContext.drawImage(
          source,
          crop.x * scale,
          crop.y * scale,
          crop.width * scale,
          crop.height * scale,
          0,
          0,
          target.width,
          target.height,
        );
      } else {
        target.width = Math.ceil(viewport.width);
        target.height = Math.ceil(viewport.height);
        const context = target.getContext("2d");
        if (!context) return;
        task = page.render({ canvasContext: context, viewport });
        await task.promise;
      }
    };

    setFailed(false);
    void render().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [crop, document, pageNumber]);

  if (failed) {
    return (
      <p role="alert" className="p-4 text-sm text-red-700">
        Page rendering failed.
      </p>
    );
  }
  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className="h-auto w-full bg-white outline outline-1 outline-black/10"
    />
  );
}

function SourceButton({
  anchor,
  onOpen,
}: {
  anchor: SourceAnchor;
  onOpen: (anchor: SourceAnchor) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(anchor)}
      className={`${focusClass} mt-2 inline-flex min-h-8 items-center rounded-md bg-stone-100 px-2.5 text-xs font-medium tabular-nums text-stone-600 hover:bg-stone-200 active:scale-[0.96]`}
      aria-label={`Open source on PDF page ${anchor.pageNumber}`}
    >
      Page {anchor.pageNumber}
    </button>
  );
}

function TextBlock({
  block,
  onOpen,
}: {
  block: Exclude<ReflowBlock, { kind: "figure" }>;
  onOpen: (anchor: SourceAnchor) => void;
}) {
  const source = <SourceButton anchor={block.anchor} onOpen={onOpen} />;
  switch (block.kind) {
    case "heading": {
      const className =
        block.level === 1
          ? "mt-12 text-[1.9em] font-semibold leading-tight tracking-[-0.025em]"
          : block.level === 2
          ? "mt-10 text-[1.45em] font-semibold leading-tight tracking-[-0.015em]"
          : "mt-8 text-[1.18em] font-semibold leading-snug";
      return (
        <section>
          {block.level === 1 ? (
            <h2 className={className}>{block.text}</h2>
          ) : block.level === 2 ? (
            <h3 className={className}>{block.text}</h3>
          ) : (
            <h4 className={className}>{block.text}</h4>
          )}
          {source}
        </section>
      );
    }
    case "paragraph":
      return (
        <section className="mt-[1.1em]">
          <p>{block.text}</p>
          {source}
        </section>
      );
    case "list-item":
      return (
        <section className="mt-[0.8em]">
          <ul className="list-disc pl-6">
            <li className="pl-1">{block.text}</li>
          </ul>
          {source}
        </section>
      );
    case "caption":
      return (
        <section className="mt-3 text-[0.86em] leading-snug text-stone-600">
          <p>{block.text}</p>
          {source}
        </section>
      );
    case "footnote":
      return (
        <section className="mt-5 border-t border-stone-200 pt-3 text-[0.78em] leading-relaxed text-stone-600">
          <p>{block.text}</p>
          {source}
        </section>
      );
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

function ReflowBlockView({
  block,
  document,
  onOpen,
}: {
  block: ReflowBlock;
  document: PDFDocumentProxy;
  onOpen: (anchor: SourceAnchor) => void;
}) {
  return (
    <article
      id={block.id}
      data-reflow-anchor={block.id}
      className="scroll-mt-28"
    >
      {block.kind === "figure" ? (
        <figure className="my-9">
          <PageCanvas
            document={document}
            pageNumber={block.anchor.pageNumber}
            crop={block.crop}
            label={`Figure from PDF page ${block.anchor.pageNumber}`}
          />
          {block.caption && (
            <figcaption className="mt-3 text-[0.86em] leading-snug text-stone-600">
              {block.caption}
            </figcaption>
          )}
          <SourceButton anchor={block.anchor} onOpen={onOpen} />
        </figure>
      ) : (
        <TextBlock block={block} onOpen={onOpen} />
      )}
    </article>
  );
}

function Diagnostics({ document }: { document: ReflowDocument }) {
  return (
    <aside
      aria-label="Reflow diagnostics"
      className="h-full overflow-auto border-l border-stone-200 bg-stone-50 p-4 text-xs text-stone-700"
    >
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="font-semibold text-stone-950">Qualification</p>
        <p className="mt-1 capitalize">{document.qualification}</p>
        <p className="mt-3 tabular-nums text-stone-500">
          {document.supportedPageCount} reflowed, {document.fallbackPageCount}{" "}
          original
        </p>
      </div>
      <div className="mt-3 space-y-3">
        {document.pages.map((page) => (
          <section
            key={page.pageNumber}
            className="rounded-xl border border-stone-200 bg-white p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-stone-950">
                Page {page.pageNumber}
              </h2>
              <span
                className={
                  page.kind === "reflowed"
                    ? "text-emerald-700"
                    : "text-amber-700"
                }
              >
                {page.kind === "reflowed"
                  ? "Reflowed"
                  : fallbackLabel(page.reason)}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
              <dt className="text-stone-500">Items</dt>
              <dd>{page.diagnostics.combinedItemCount}</dd>
              <dt className="text-stone-500">Uncombined</dt>
              <dd>{page.diagnostics.uncombinedItemCount}</dd>
              <dt className="text-stone-500">Lines</dt>
              <dd>{page.diagnostics.lineCount}</dd>
              <dt className="text-stone-500">Columns</dt>
              <dd>{page.diagnostics.detectedColumns}</dd>
              <dt className="text-stone-500">Images</dt>
              <dd>{page.diagnostics.largeImageCount}</dd>
              <dt className="text-stone-500">Table rows</dt>
              <dd>{page.diagnostics.tableRowCount}</dd>
              <dt className="text-stone-500">Equations</dt>
              <dd>{page.diagnostics.equationLineCount}</dd>
              <dt className="text-stone-500">Annotations</dt>
              <dd>{page.diagnostics.annotationCount}</dd>
            </dl>
            {page.diagnostics.structTreeRoles.length > 0 && (
              <p className="mt-3 break-words text-stone-500">
                Tags: {page.diagnostics.structTreeRoles.slice(0, 12).join(", ")}
              </p>
            )}
          </section>
        ))}
      </div>
    </aside>
  );
}

function LoadedPrototype({
  document,
  fixture,
  fontSize,
  lineHeight,
  readingWidth,
  showDiagnostics,
  mode,
  onModeChange,
}: {
  document: PDFDocumentProxy;
  fixture: Fixture;
  fontSize: number;
  lineHeight: number;
  readingWidth: number;
  showDiagnostics: boolean;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}) {
  const [result, setResult] = useState<ReflowDocument | null>(null);
  const [progress, setProgress] = useState({
    completed: 0,
    total: document.numPages,
  });
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<PDFViewer | null>(null);
  const locationRef = useRef<OriginalLocation | null>(null);
  const currentAnchorRef = useRef<SourceAnchor | null>(null);
  const pendingOriginalRef = useRef<SourceAnchor | null>(null);
  const pendingReflowRef = useRef<string | null>(null);
  const reflowScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);
    setProgress({ completed: 0, total: document.numPages });
    void extractDocument(document, (completed, total) => {
      if (!cancelled) setProgress({ completed, total });
    })
      .then((pages) => {
        if (!cancelled) {
          const reconstructed = reconstructDocument(pages);
          setResult(reconstructed);
          currentAnchorRef.current = firstAnchor(reconstructed);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(messageFrom(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [document]);

  useEffect(() => {
    if (!viewer) return;
    const update = ({ location }: { location: OriginalLocation }) => {
      locationRef.current = location;
    };
    viewer.eventBus.on("updateviewarea", update);
    return () => viewer.eventBus.off("updateviewarea", update);
  }, [viewer]);

  const jumpToOriginal = useCallback(
    async (anchor: SourceAnchor) => {
      pendingOriginalRef.current = anchor;
      onModeChange("original");
    },
    [onModeChange],
  );

  useEffect(() => {
    if (mode !== "original" || !viewer) return;
    const anchor = pendingOriginalRef.current;
    if (!anchor) return;
    pendingOriginalRef.current = null;
    void (async () => {
      const page = await document.getPage(anchor.pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const point = viewport.convertToPdfPoint(
        anchor.boundingRect.x,
        anchor.boundingRect.y,
      ) as unknown as [number, number];
      viewer.scrollPageIntoView({
        pageNumber: anchor.pageNumber,
        destArray: [null, { name: "XYZ" }, point[0], point[1], null],
        ignoreDestinationZoom: true,
      });
    })();
  }, [document, mode, viewer]);

  useEffect(() => {
    if (mode !== "reflow") return;
    const id = pendingReflowRef.current;
    if (!id) return;
    pendingReflowRef.current = null;
    requestAnimationFrame(
      () =>
        window.document.getElementById(id)?.scrollIntoView({ block: "start" }),
    );
  }, [mode]);

  useEffect(() => {
    const container = reflowScrollRef.current;
    if (!container || mode !== "reflow" || !result) return;
    const anchors = new Map<string, SourceAnchor>();
    for (const page of result.pages) {
      if (page.kind === "fallback")
        anchors.set(`fallback-${page.pageNumber}`, page.anchor);
      else for (const block of page.blocks) anchors.set(block.id, block.anchor);
    }
    const track = () => {
      const top = container.getBoundingClientRect().top + 100;
      const candidates = Array.from(
        container.querySelectorAll<HTMLElement>("[data-reflow-anchor]"),
      );
      const nearest = candidates.sort(
        (a, b) =>
          Math.abs(a.getBoundingClientRect().top - top) -
          Math.abs(b.getBoundingClientRect().top - top),
      )[0];
      const id = nearest?.dataset.reflowAnchor;
      if (id)
        currentAnchorRef.current = anchors.get(id) ?? currentAnchorRef.current;
    };
    track();
    container.addEventListener("scroll", track, { passive: true });
    return () => container.removeEventListener("scroll", track);
  }, [mode, result]);

  const switchToReflow = useCallback(async () => {
    if (!result) return;
    const location = locationRef.current;
    if (location) {
      const page = await document.getPage(location.pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const point = viewport.convertToViewportPoint(
        location.left,
        location.top,
      ) as unknown as [number, number];
      const block = findBlockNearestPoint(
        result,
        location.pageNumber,
        point[1],
      );
      pendingReflowRef.current =
        block?.id ?? `reflow-page-${location.pageNumber}`;
    }
    onModeChange("reflow");
  }, [document, onModeChange, result]);

  const switchToOriginal = useCallback(() => {
    const anchor = currentAnchorRef.current;
    if (anchor) pendingOriginalRef.current = anchor;
    onModeChange("original");
  }, [onModeChange]);

  if (error) {
    return (
      <div
        role="alert"
        className="m-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
      >
        {error}
      </div>
    );
  }

  const isExtracting = result === null;
  return (
    <div className="flex min-h-0 flex-1">
      <main
        className="relative min-w-0 flex-1 bg-stone-100"
        id="reflow-content"
      >
        <div className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 rounded-xl border border-stone-200 bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          {(["original", "reflow"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={value === "reflow" && isExtracting}
              onClick={() =>
                value === "reflow" ? void switchToReflow() : switchToOriginal()
              }
              className={`${focusClass} min-h-9 rounded-lg px-4 text-sm font-medium capitalize transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === value
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {mode === "original" ? (
          <div className="h-full pt-16">
            <PdfHighlighter
              pdfDocument={document}
              pdfScaleValue="auto"
              highlights={[]}
              showAiFeatures={false}
              highlighterRef={(instance: HighlighterInstance | null) =>
                setViewer(instance?.viewer ?? null)
              }
              addHighlight={() => {}}
              deleteHighlight={() => {}}
              updateAreaHighlight={() => {}}
              readSelectedText={async () => {}}
            />
          </div>
        ) : isExtracting ? (
          <div
            className="flex h-full items-center justify-center"
            role="status"
          >
            <div className="rounded-2xl border border-stone-200 bg-white px-8 py-7 text-center shadow-sm">
              <Spinner />
              <p className="mt-4 text-sm font-medium text-stone-800">
                Inspecting page {progress.completed + 1} of {progress.total}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Text, geometry, tags, and drawing operators
              </p>
            </div>
          </div>
        ) : (
          <div
            ref={reflowScrollRef}
            className="h-full overflow-auto px-4 pb-28 pt-20 sm:px-8"
          >
            <div
              className="mx-auto rounded-2xl bg-[#fffefa] px-6 py-10 text-stone-900 shadow-[0_2px_20px_rgba(0,0,0,0.06)] sm:px-12 sm:py-14"
              style={{ maxWidth: `${readingWidth}ch`, fontSize, lineHeight }}
            >
              <header className="mb-12 border-b border-stone-200 pb-7">
                <p className="text-[0.7em] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Experimental reflow
                </p>
                <h1 className="mt-2 text-[1.8em] font-semibold leading-tight tracking-[-0.03em]">
                  {fixture.label}
                </h1>
                <p className="mt-2 text-[0.82em] text-stone-500">
                  {result.qualification === "unsupported"
                    ? `${fixture.shape}. Original pages are preserved.`
                    : `${fixture.shape}. Selectable text with page-level source anchors.`}
                </p>
              </header>
              {result.pages.map((page) => (
                <section
                  key={page.pageNumber}
                  id={`reflow-page-${page.pageNumber}`}
                  data-reflow-anchor={
                    page.kind === "fallback"
                      ? `fallback-${page.pageNumber}`
                      : undefined
                  }
                  className="scroll-mt-24"
                >
                  {page.kind === "fallback" ? (
                    <div className="my-10 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-6">
                      <div className="mb-4 flex items-start gap-3 text-amber-950">
                        <AlertTriangle
                          aria-hidden="true"
                          className="mt-0.5 h-5 w-5 shrink-0"
                          strokeWidth={1.5}
                        />
                        <div>
                          <h2 className="text-base font-semibold">
                            Page {page.pageNumber} kept original
                          </h2>
                          <p className="mt-1 text-sm leading-relaxed">
                            {fallbackLabel(page.reason)}. Reflow would risk
                            changing the document's meaning.
                          </p>
                        </div>
                      </div>
                      <PageCanvas
                        document={document}
                        pageNumber={page.pageNumber}
                        label={`Original PDF page ${page.pageNumber}`}
                      />
                      <SourceButton
                        anchor={page.anchor}
                        onOpen={jumpToOriginal}
                      />
                    </div>
                  ) : (
                    <>
                      {page.pageNumber > 1 && (
                        <div className="my-12 border-t border-stone-200" />
                      )}
                      {page.blocks.map((block) => (
                        <ReflowBlockView
                          key={block.id}
                          block={block}
                          document={document}
                          onOpen={jumpToOriginal}
                        />
                      ))}
                    </>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}
      </main>
      {showDiagnostics && result && (
        <div className="hidden w-80 shrink-0 lg:block">
          <Diagnostics document={result} />
        </div>
      )}
    </div>
  );
}

export default function ReflowPrototype() {
  const [fixture, setFixture] = useState<Fixture>(DEFAULT_FIXTURE);
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("original");
  const [fontSize, setFontSize] = useState(19);
  const [lineHeight, setLineHeight] = useState(1.65);
  const [readingWidth, setReadingWidth] = useState(62);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (customUrl) URL.revokeObjectURL(customUrl);
    },
    [customUrl],
  );

  const url = customUrl ?? fixture.url;
  const statusText = `${fixture.label}. ${
    mode === "original" ? "Original PDF view" : "Reflow reading view"
  }.`;

  return (
    <div className="flex h-screen min-h-[32rem] flex-col overflow-hidden bg-stone-100 text-stone-950">
      <a
        href="#reflow-content"
        className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to reader
      </a>
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-3 py-2.5 sm:px-5">
        <div className="mr-2 flex items-center gap-2">
          <FlaskConical
            aria-hidden="true"
            className="h-5 w-5"
            strokeWidth={1.5}
          />
          <div>
            <p className="text-sm font-semibold">Reflow lab</p>
            <p className="text-[11px] text-stone-500">PDF.js 2.16.105</p>
          </div>
        </div>

        <label className="sr-only" htmlFor="fixture">
          Test document
        </label>
        <select
          id="fixture"
          className={controlClass}
          value={customUrl ? "custom" : fixture.id}
          onChange={(event) => {
            if (event.target.value === "custom") return;
            const next = FIXTURES.find(
              (candidate) => candidate.id === event.target.value,
            );
            if (!next) return;
            if (customUrl) URL.revokeObjectURL(customUrl);
            setCustomUrl(null);
            setFixture(next);
            setMode("original");
            setLoadError(null);
          }}
        >
          {FIXTURES.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
          {customUrl && <option value="custom">Local PDF</option>}
        </select>

        <label
          className={`${controlClass} inline-flex cursor-pointer items-center gap-2 hover:bg-stone-50 active:scale-[0.96]`}
        >
          <Upload aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          Open PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (customUrl) URL.revokeObjectURL(customUrl);
              setCustomUrl(URL.createObjectURL(file));
              setFixture({
                id: "custom",
                label: file.name,
                shape: "Local document",
                url: "",
              });
              setMode("original");
              setLoadError(null);
            }}
          />
        </label>

        <div className="ml-auto hidden items-center gap-4 xl:flex">
          <label className="flex items-center gap-2 text-xs text-stone-600">
            Size{" "}
            <input
              aria-label="Font size"
              type="range"
              min="14"
              max="28"
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
            />
            <span className="w-7 tabular-nums">{fontSize}</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-stone-600">
            Leading{" "}
            <input
              aria-label="Line height"
              type="range"
              min="1.3"
              max="2"
              step="0.05"
              value={lineHeight}
              onChange={(event) => setLineHeight(Number(event.target.value))}
            />
            <span className="w-8 tabular-nums">{lineHeight.toFixed(2)}</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-stone-600">
            Width{" "}
            <input
              aria-label="Reading width"
              type="range"
              min="38"
              max="82"
              value={readingWidth}
              onChange={(event) => setReadingWidth(Number(event.target.value))}
            />
            <span className="w-8 tabular-nums">{readingWidth}</span>
          </label>
        </div>

        <button
          type="button"
          aria-pressed={showDiagnostics}
          onClick={() => setShowDiagnostics((value) => !value)}
          className={`${focusClass} inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm ${
            showDiagnostics
              ? "border-stone-900 bg-stone-900 text-white"
              : "border-stone-300 bg-white text-stone-800"
          }`}
        >
          <Inspect aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          Diagnostics
        </button>
      </header>

      <p className="sr-only" role="status">
        {statusText}
      </p>
      {loadError && (
        <p
          role="alert"
          className="border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-800"
        >
          {loadError}
        </p>
      )}
      <PdfLoader
        key={url}
        url={url}
        workerSrc={WORKER_SRC}
        beforeLoad={
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        }
        errorMessage={
          <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            Could not open this PDF.
          </div>
        }
        onError={(error) => setLoadError(error.message)}
      >
        {(document: PDFDocumentProxy) => (
          <LoadedPrototype
            document={document}
            fixture={fixture}
            fontSize={fontSize}
            lineHeight={lineHeight}
            readingWidth={readingWidth}
            showDiagnostics={showDiagnostics}
            mode={mode}
            onModeChange={setMode}
          />
        )}
      </PdfLoader>
    </div>
  );
}

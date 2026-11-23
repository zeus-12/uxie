import type { PDFPageProxy, RenderTask } from "pdfjs-dist";
import { Fragment, memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { sliceOfRun, type ItemRange } from "../../../lib/reflow/anchors";
import type { PageInput, Rect, ReflowPage, Run, TextRegion } from "../../../lib/reflow/types";

export type LoadedPage = { page: ReflowPage; input: PageInput; pdfPage: PDFPageProxy };

export type PageMarks = {
  search: ItemRange[];
  selectedSearch: number | null;
  highlights: Array<ItemRange & { id?: string }>;
  links: Array<ItemRange & { link: ReflowLink }>;
};

export type ReflowLink = { url: string } | { pageNumber: number; fy: number };

const MAX_CANVAS_PIXELS = 4_000_000;
const MAX_HEADING_SCALE = 1.8;

// pdf.js's text layer only appends a span for a non-empty item, so this is the
// item's index among a page's text-layer spans: the read-aloud model's block.
const textItemOrdinals = (strings: string[]) => {
  let next = 0;
  return strings.map((str) => (str === "" ? -1 : next++));
};

export const runKey = (pageNumber: number, itemIndex: number) => `${pageNumber}:${itemIndex}`;

const CropCanvas = ({
  pdfPage,
  rect,
  pxPerPt,
  index,
  fitWidth = false,
}: {
  pdfPage: PDFPageProxy;
  rect: Rect;
  pxPerPt: number;
  index: number;
  fitWidth?: boolean;
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxWidth, setBoxWidth] = useState<number | null>(null);
  const { x, y, width, height } = rect;

  useEffect(() => {
    const box = boxRef.current;
    if (!fitWidth || !box) return;
    const observer = new ResizeObserver(() => setBoxWidth(box.clientWidth));
    observer.observe(box);
    return () => observer.disconnect();
  }, [fitWidth]);

  const cssPxPerPt = fitWidth ? (boxWidth === null ? null : boxWidth / width) : pxPerPt;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cssPxPerPt === null) return;
    const rect = { x, y, width, height };
    const wanted = cssPxPerPt * (window.devicePixelRatio || 1);
    const cap = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, rect.width * rect.height));
    const s = Math.min(wanted, cap);
    canvas.width = Math.max(1, Math.round(rect.width * s));
    canvas.height = Math.max(1, Math.round(rect.height * s));
    const context = canvas.getContext("2d");
    if (!context) return;
    const viewport = pdfPage.getViewport({ scale: s, offsetX: -rect.x * s, offsetY: -rect.y * s });
    let task: RenderTask | null = pdfPage.render({ canvasContext: context, viewport });
    task.promise.catch(() => undefined).finally(() => {
      task = null;
    });
    return () => task?.cancel();
  }, [pdfPage, x, y, width, height, cssPxPerPt]);
  return (
    <div
      ref={boxRef}
      className="reflow-crop"
      data-crop={index}
      data-crop-x={rect.x}
      data-crop-y={rect.y}
      data-crop-w={rect.width}
      data-crop-h={rect.height}
    >
      <canvas
        ref={canvasRef}
        style={
          fitWidth
            ? { width: "100%", aspectRatio: `${rect.width} / ${rect.height}` }
            : {
                width: `calc(var(--reflow-pt) * ${rect.width})`,
                height: `calc(var(--reflow-pt) * ${rect.height})`,
              }
        }
      />
    </div>
  );
};

type Slice = {
  from: number;
  to: number;
  search: boolean;
  selected: boolean;
  highlight: boolean;
  highlightId: string | undefined;
  link: ReflowLink | undefined;
};

const runSlices = (run: Run, marks: PageMarks): Slice[] => {
  const cuts = new Set<number>([run.start, run.end]);
  const tagged: Array<{
    from: number;
    to: number;
    kind: "search" | "selected" | "highlight" | "link";
    id?: string;
    link?: ReflowLink;
  }> = [];
  marks.search.forEach((range, i) => {
    const s = sliceOfRun(run, range);
    if (!s) return;
    tagged.push({ ...s, kind: i === marks.selectedSearch ? "selected" : "search" });
  });
  for (const range of marks.highlights) {
    const s = sliceOfRun(run, range);
    if (s) tagged.push({ ...s, kind: "highlight", id: range.id });
  }
  for (const range of marks.links) {
    const s = sliceOfRun(run, range);
    if (s) tagged.push({ ...s, kind: "link", link: range.link });
  }
  for (const t of tagged) {
    cuts.add(t.from);
    cuts.add(t.to);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: Slice[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const covering = tagged.filter((t) => t.from <= from && t.to >= to);
    out.push({
      from,
      to,
      search: covering.some((t) => t.kind === "search" || t.kind === "selected"),
      selected: covering.some((t) => t.kind === "selected"),
      highlight: covering.some((t) => t.kind === "highlight"),
      highlightId: covering.find((t) => t.kind === "highlight" && t.id)?.id,
      link: covering.find((t) => t.kind === "link")?.link,
    });
  }
  return out;
};

const RunText = ({ str, run, marks }: { str: string; run: Run; marks: PageMarks }) => {
  const slices = runSlices(run, marks);
  return (
    <>
      {slices.map((s) => {
        const text = str.slice(s.from, s.to);
        let node: ReactNode = text;
        if (s.search) {
          node = (
            <mark className="reflow-search" data-selected={s.selected || undefined}>
              {node}
            </mark>
          );
        }
        if (s.highlight) {
          node = (
            <mark className="reflow-highlight" data-highlight-id={s.highlightId}>
              {node}
            </mark>
          );
        }
        if (s.link && "url" in s.link) {
          node = (
            <a className="reflow-link" href={s.link.url} target="_blank" rel="noopener noreferrer">
              {node}
            </a>
          );
        } else if (s.link) {
          node = (
            <a
              className="reflow-link"
              href={`#page=${s.link.pageNumber}`}
              data-link-page={s.link.pageNumber}
              data-link-y={s.link.fy}
            >
              {node}
            </a>
          );
        }
        return <Fragment key={s.from}>{node}</Fragment>;
      })}
    </>
  );
};

const TAGS = { heading: "h3", paragraph: "p", "list-item": "p", caption: "p", footnote: "p" } as const;

const TextBlock = ({
  region,
  pageNumber,
  bodyPt,
  strings,
  ordinals,
  marks,
}: {
  ordinals: number[];
  region: TextRegion;
  pageNumber: number;
  bodyPt: number;
  strings: string[];
  marks: PageMarks;
}) => {
  const Tag = region.role === "heading" ? (`h${(region.level ?? 3) + 1}` as "h2" | "h3" | "h4") : TAGS[region.role];
  const scale = Math.min(region.fontScale, MAX_HEADING_SCALE);
  return (
    <Tag
      data-reflow-block=""
      className={`reflow-block reflow-${region.role}`}
      style={{ fontSize: `calc(var(--reflow-pt) * ${(bodyPt * scale).toFixed(2)})` }}
    >
      {region.runs.map((run) => (
        <Fragment key={run.itemIndex}>
          {run.sep}
          <span
            data-run={runKey(pageNumber, run.itemIndex)}
            data-run-start={run.start}
            data-item-ordinal={ordinals[run.itemIndex]}
            className={run.sup ? "reflow-sup" : undefined}
          >
            <RunText str={strings[run.itemIndex] ?? ""} run={run} marks={marks} />
          </span>
        </Fragment>
      ))}
    </Tag>
  );
};

export const ReflowPageView = memo(function ReflowPageView({
  loaded,
  pxPerPt,
  marks,
}: {
  loaded: LoadedPage;
  pxPerPt: number;
  marks: PageMarks;
}) {
  const { page, input, pdfPage } = loaded;
  const ordinals = useMemo(() => textItemOrdinals(input.itemStrings), [input.itemStrings]);
  if (page.kind === "keep") {
    return (
      <section className="reflow-page reflow-kept" data-reflow-page={page.pageNumber} data-page-w={page.width} data-page-h={page.height}>
        <CropCanvas
          pdfPage={pdfPage}
          rect={{ x: 0, y: 0, width: page.width, height: page.height }}
          pxPerPt={pxPerPt}
          index={0}
          fitWidth
        />
      </section>
    );
  }
  return (
    <section className="reflow-page" data-reflow-page={page.pageNumber} data-page-w={page.width} data-page-h={page.height}>
      {page.regions.map((region, i) =>
        region.kind === "crop" ? (
          <CropCanvas key={i} pdfPage={pdfPage} rect={region.rect} pxPerPt={pxPerPt} index={i} />
        ) : (
          <TextBlock
            key={i}
            region={region}
            pageNumber={page.pageNumber}
            bodyPt={page.bodyFontSize}
            strings={input.itemStrings}
            ordinals={ordinals}
            marks={marks}
          />
        ),
      )}
    </section>
  );
});

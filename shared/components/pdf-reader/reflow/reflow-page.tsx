import type { PDFPageProxy, RenderTask } from "pdfjs-dist";
import { Fragment, memo, useEffect, useRef, type ReactNode } from "react";
import { sliceOfRun, type ItemRange } from "../../../lib/reflow/anchors";
import type { PageInput, Rect, ReflowPage, Run, TextRegion } from "../../../lib/reflow/types";

export type LoadedPage = { page: ReflowPage; input: PageInput; pdfPage: PDFPageProxy };

export type PageMarks = {
  search: ItemRange[];
  selectedSearch: number | null;
  highlights: ItemRange[];
};

const MAX_CANVAS_PIXELS = 4_000_000;
const MAX_HEADING_SCALE = 1.8;

export const runKey = (pageNumber: number, itemIndex: number) => `${pageNumber}:${itemIndex}`;

const CropCanvas = ({
  pdfPage,
  rect,
  pxPerPt,
  index,
}: {
  pdfPage: PDFPageProxy;
  rect: Rect;
  pxPerPt: number;
  index: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wanted = pxPerPt * (window.devicePixelRatio || 1);
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
  }, [pdfPage, rect, pxPerPt]);
  return (
    <div className="reflow-crop" data-crop={index} data-crop-y={rect.y}>
      <canvas
        ref={canvasRef}
        style={{
          width: `calc(var(--reflow-pt) * ${rect.width})`,
          height: `calc(var(--reflow-pt) * ${rect.height})`,
        }}
      />
    </div>
  );
};

type Slice = { from: number; to: number; search: boolean; selected: boolean; highlight: boolean };

const runSlices = (run: Run, marks: PageMarks): Slice[] => {
  const cuts = new Set<number>([run.start, run.end]);
  const tagged: Array<{ from: number; to: number; kind: "search" | "selected" | "highlight" }> = [];
  marks.search.forEach((range, i) => {
    const s = sliceOfRun(run, range);
    if (!s) return;
    tagged.push({ ...s, kind: i === marks.selectedSearch ? "selected" : "search" });
  });
  for (const range of marks.highlights) {
    const s = sliceOfRun(run, range);
    if (s) tagged.push({ ...s, kind: "highlight" });
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
        if (s.highlight) node = <mark className="reflow-highlight">{node}</mark>;
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
  marks,
}: {
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
          <span data-run={runKey(pageNumber, run.itemIndex)} className={run.sup ? "reflow-sup" : undefined}>
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
  if (page.kind === "keep") {
    return (
      <section className="reflow-page reflow-kept" data-reflow-page={page.pageNumber}>
        <CropCanvas
          pdfPage={pdfPage}
          rect={{ x: 0, y: 0, width: page.width, height: page.height }}
          pxPerPt={pxPerPt}
          index={0}
        />
      </section>
    );
  }
  return (
    <section className="reflow-page" data-reflow-page={page.pageNumber}>
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
            marks={marks}
          />
        ),
      )}
    </section>
  );
});

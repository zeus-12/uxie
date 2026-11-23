import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { PDFViewer } from "pdfjs-dist/types/web/pdf_viewer";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type ReactNode,
} from "react";
import { selectedSlices, selectionToPosition, type ReflowSelection } from "./selection";
import { beginProgrammaticScroll } from "../../../hooks/use-sentence-reader";
import { REFLOW_REVEAL_EVENT, announceReflowLayout } from "../../../lib/reflow/reveal";
import { convertMatches, type ItemRange } from "../../../lib/reflow/anchors";
import type { ReflowSource } from "../../../lib/reflow/source";
import type { PageInput, Rect, Run } from "../../../lib/reflow/types";
import type { PdfPoint, ScreenAnchor } from "./canvas-anchor";
import { caretAt, charRect, offsetWithin } from "./caret";
import { highlightRanges } from "./highlight-ranges";
import { ReflowPageView, runKey, type LoadedPage, type PageMarks } from "./reflow-page";

export const CSS_PX_PER_PT = 96 / 72;
const WINDOW_RADIUS = 3;
const PRELOAD_MARGIN_PX = 800;

export type ReflowLayerApi = {
  anchorAt: (clientX: number, clientY: number) => ScreenAnchor | null;
  topAnchor: () => ScreenAnchor | null;
  previewScale: (scale: number, keep: ScreenAnchor) => void;
  showPagePoint: (pageNumber: number, fx: number, fy: number) => void;
};

type FindController = {
  highlightMatches: boolean;
  pageMatches: number[][];
  pageMatchesLength: number[][];
  selected: { pageIdx: number; matchIdx: number };
  state: { query?: unknown } | null;
};

type EventBus = {
  on: (name: string, fn: (e: unknown) => void) => void;
  off: (name: string, fn: (e: unknown) => void) => void;
};

type Props = {
  source: ReflowSource;
  pdfDocument: PDFDocumentProxy;
  viewer: PDFViewer;
  findController: FindController | null;
  eventBus: EventBus;
  scale: number;
  anchor: ScreenAnchor;
  highlightRects: (pageNumber: number, width: number, height: number) => Rect[];
  visible: boolean;
  onPlaced: () => void;
  onFailed: () => void;
  onResized: () => void;
  renderSelection?: (selection: ReflowSelection, close: () => void, keepVisible: () => void) => ReactNode;
};

type RunEntry = { pageNumber: number; run: Run };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

const emptyInput = (pageNumber: number, width: number, height: number): PageInput => ({
  pageNumber,
  width,
  height,
  items: [],
  itemStrings: [],
  images: [],
  paths: [],
  formWidgetCount: 0,
  structRoles: {},
});

// Crops follow the text scale and kept pages fit the width, so measure the image.
const cropScale = (crop: HTMLElement) => {
  const canvas = crop.querySelector("canvas")?.getBoundingClientRect();
  const width = Number(crop.dataset.cropW);
  return canvas && canvas.width > 0 && width > 0 ? canvas.width / width : null;
};

// Kept pages have no runs; a point on one maps through the page image it shows.
const sectionAnchorAt = (
  root: HTMLElement,
  clientX: number,
  clientY: number,
  pxPerPt: number,
): ScreenAnchor | null => {
  let best: { section: HTMLElement; d: number } | null = null;
  for (const section of root.querySelectorAll<HTMLElement>("[data-reflow-page]")) {
    const r = section.getBoundingClientRect();
    const d = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0;
    if (!best || d < best.d) best = { section, d };
  }
  if (!best) return null;
  const keptCrop = best.section.classList.contains("reflow-kept")
    ? best.section.querySelector<HTMLElement>(".reflow-crop")
    : null;
  const scale = (keptCrop && cropScale(keptCrop)) ?? pxPerPt;
  const image = (keptCrop?.querySelector("canvas") ?? best.section).getBoundingClientRect();
  const y = Math.min(Math.max(clientY, image.top), image.bottom);
  return {
    point: { pageNumber: Number(best.section.dataset.reflowPage), x: 0, y: (y - image.top) / scale },
    clientX: image.left,
    clientY: y,
  };
};

export const ReflowLayer = forwardRef<ReflowLayerApi, Props>(function ReflowLayer(
  { source, pdfDocument, viewer, findController, eventBus, scale, anchor, highlightRects, visible, onPlaced, onFailed, onResized, renderSelection },
  ref,
) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<LoadedPage[]>([]);
  const pagesRef = useRef<LoadedPage[]>([]);
  const [findVersion, setFindVersion] = useState(0);
  const [highlightsByPage, setHighlightsByPage] = useState<Record<number, ItemRange[]>>({});
  const loading = useRef(new Set<number>());
  const pendingAnchor = useRef<ScreenAnchor | null>(anchor);
  const keepInPlace = useRef<{ pageNumber: number; top: number } | null>(null);
  const windowRequest = useRef(0);
  const syncingPage = useRef(false);
  const handledFind = useRef<string | null>(null);
  const rangeCache = useRef(new WeakMap<PDFPageProxy, { key: string; ranges: ItemRange[] }>());
  const pxPerPt = scale * CSS_PX_PER_PT;
  const livePxPerPt = useRef(pxPerPt);
  const viewTop = useRef<ScreenAnchor | null>(null);

  const load = useCallback(
    async (pageNumber: number): Promise<LoadedPage> => {
      const pdfPage = await pdfDocument.getPage(pageNumber);
      const reconstructed = await Promise.all([source.page(pageNumber), source.pageInput(pageNumber)]).catch(
        () => null,
      );
      if (reconstructed) return { page: reconstructed[0], input: reconstructed[1], pdfPage };
      const { width, height } = pdfPage.getViewport({ scale: 1 });
      return {
        page: { kind: "keep", pageNumber, width, height, reason: "unreadable" },
        input: emptyInput(pageNumber, width, height),
        pdfPage,
      };
    },
    [source, pdfDocument],
  );

  const runIndex = useMemo(() => {
    const map = new Map<string, RunEntry>();
    for (const { page } of pages) {
      if (page.kind !== "reflow") continue;
      for (const region of page.regions) {
        if (region.kind !== "text") continue;
        for (const run of region.runs) map.set(runKey(page.pageNumber, run.itemIndex), { pageNumber: page.pageNumber, run });
      }
    }
    return map;
  }, [pages]);

  const openWindow = useCallback(
    async (centre: number, then: ScreenAnchor | null) => {
      const request = ++windowRequest.current;
      loading.current.clear();
      const from = Math.max(1, centre - 1);
      const to = Math.min(pdfDocument.numPages, centre + 1);
      const settled = await Promise.allSettled(
        Array.from({ length: to - from + 1 }, (_, i) => load(from + i)),
      );
      if (request !== windowRequest.current) return;
      const at = centre - from;
      if (settled[at]?.status !== "fulfilled") {
        onFailed();
        return;
      }
      let first = at;
      let last = at;
      while (first > 0 && settled[first - 1]!.status === "fulfilled") first--;
      while (last < settled.length - 1 && settled[last + 1]!.status === "fulfilled") last++;
      const loaded = settled
        .slice(first, last + 1)
        .map((r) => (r as PromiseFulfilledResult<LoadedPage>).value);
      pendingAnchor.current = then;
      pagesRef.current = loaded;
      setPages(loaded);
    },
    [load, pdfDocument.numPages, onFailed],
  );

  useEffect(() => {
    void openWindow(anchor.point.pageNumber, anchor);
  }, [openWindow, anchor]);

  useEffect(
    () => () => {
      windowRequest.current += 1;
    },
    [],
  );

  const openAtPageTop = useCallback(
    (pageNumber: number) => {
      const root = scroller();
      if (!root) return;
      const r = root.getBoundingClientRect();
      void openWindow(pageNumber, { point: { pageNumber, x: 0, y: 0 }, clientX: r.left, clientY: r.top });
    },
    [openWindow],
  );

  const scroller = () => scrollerRef.current;

  const placeAnchor = useCallback(
    (target: ScreenAnchor, ppt: number) => {
      const root = scroller();
      if (!root) return false;
      const { pageNumber, y } = target.point;
      const section = root.querySelector<HTMLElement>(`[data-reflow-page="${pageNumber}"]`);
      if (!section) return false;
      const loaded = pages.find((p) => p.page.pageNumber === pageNumber);
      if (!loaded) return false;
      let elementTop: number | null = null;
      const char = target.char;
      if (char && loaded.page.kind === "reflow") {
        for (const region of loaded.page.regions) {
          if (region.kind !== "text") continue;
          const run = region.runs.find(
            (r) => r.itemIndex === char.itemIndex && char.offset >= r.start && char.offset <= r.end,
          );
          if (!run) continue;
          const el = section.querySelector<HTMLElement>(`[data-run="${runKey(pageNumber, run.itemIndex)}"]`);
          const glyph = el ? charRect(el, Math.min(char.offset, run.end - 1) - run.start) : null;
          if (glyph) {
            beginProgrammaticScroll(root);
            root.scrollTop += glyph.top + glyph.height / 2 - target.clientY;
            return true;
          }
        }
      }
      if (loaded.page.kind === "reflow") {
        let best: { run: Run; d: number } | null = null;
        for (const [index, region] of loaded.page.regions.entries()) {
          if (region.kind === "crop") {
            const r = region.rect;
            if (y >= r.y && y <= r.y + r.height && target.point.x >= r.x && target.point.x <= r.x + r.width) {
              const el = section.querySelector<HTMLElement>(`[data-crop="${index}"]`);
              const s = el && cropScale(el);
              if (el && s) {
                beginProgrammaticScroll(root);
                root.scrollTop += el.getBoundingClientRect().top + (y - r.y) * s - target.clientY;
                return true;
              }
            }
            continue;
          }
          for (const run of region.runs) {
            const r = run.rect;
            const dy = y < r.y ? r.y - y : y > r.y + r.height ? y - (r.y + r.height) : 0;
            const dx = target.point.x < r.x ? r.x - target.point.x : target.point.x > r.x + r.width ? target.point.x - (r.x + r.width) : 0;
            const d = dy * 4 + dx;
            if (!best || d < best.d) best = { run, d };
          }
        }
        if (best) {
          const el = section.querySelector<HTMLElement>(`[data-run="${runKey(pageNumber, best.run.itemIndex)}"]`);
          if (el) {
            const within =
              best.run.rect.height > 0 ? clamp((y - best.run.rect.y) / best.run.rect.height, 0, 1) : 0;
            const line = el.getClientRects()[0] ?? el.getBoundingClientRect();
            elementTop = line.top + within * line.height;
          }
        }
      }
      if (elementTop === null) {
        const keptCrop = loaded.page.kind === "keep" ? section.querySelector<HTMLElement>(".reflow-crop") : null;
        const s = (keptCrop && cropScale(keptCrop)) ?? ppt;
        elementTop = (keptCrop ?? section).getBoundingClientRect().top + y * s;
      }
      beginProgrammaticScroll(root);
      root.scrollTop += elementTop - target.clientY;
      return true;
    },
    [pages],
  );

  useLayoutEffect(() => {
    const root = scroller();
    if (!root) return;
    const kept = keepInPlace.current;
    if (kept) {
      const section = root.querySelector<HTMLElement>(`[data-reflow-page="${kept.pageNumber}"]`);
      if (section) {
        beginProgrammaticScroll(root);
        root.scrollTop += section.getBoundingClientRect().top - kept.top;
      }
      keepInPlace.current = null;
    }
    const target = pendingAnchor.current;
    if (target && placeAnchor(target, pxPerPt)) {
      pendingAnchor.current = null;
      onPlaced();
    }
  }, [pages, placeAnchor, pxPerPt, onPlaced]);

  // Trimming a page the observer still sees would make it extend straight back.
  const withinPreload = (pageNumber: number) => {
    const root = scroller();
    const section = root?.querySelector<HTMLElement>(`[data-reflow-page="${pageNumber}"]`);
    if (!root || !section) return false;
    const r = root.getBoundingClientRect();
    const s = section.getBoundingClientRect();
    return s.bottom > r.top - PRELOAD_MARGIN_PX && s.top < r.bottom + PRELOAD_MARGIN_PX;
  };

  const extend = useCallback(
    async (direction: -1 | 1) => {
      const first = pages[0]?.page.pageNumber;
      const last = pages[pages.length - 1]?.page.pageNumber;
      if (first === undefined || last === undefined) return;
      const next = direction === 1 ? last + 1 : first - 1;
      if (next < 1 || next > pdfDocument.numPages || loading.current.has(next)) return;
      loading.current.add(next);
      const request = windowRequest.current;
      try {
        const loaded = await load(next).catch(() => null);
        if (!loaded || request !== windowRequest.current) return;
        const current = pagesRef.current;
        const edge = direction === 1 ? current[current.length - 1] : current[0];
        if (!edge || edge.page.pageNumber + direction !== next) return;
        const root = scroller();
        if (root) {
          const r = root.getBoundingClientRect();
          const visibleSection = [...root.querySelectorAll<HTMLElement>("[data-reflow-page]")].find(
            (el) => el.getBoundingClientRect().bottom > r.top,
          );
          if (visibleSection) {
            keepInPlace.current = {
              pageNumber: Number(visibleSection.dataset.reflowPage),
              top: visibleSection.getBoundingClientRect().top,
            };
          }
        }
        const merged = direction === 1 ? [...current, loaded] : [loaded, ...current];
        const far = direction === 1 ? merged[0] : merged[merged.length - 1];
        const trimmed =
          merged.length <= WINDOW_RADIUS * 2 + 1 || (far && withinPreload(far.page.pageNumber))
            ? merged
            : direction === 1
              ? merged.slice(1)
              : merged.slice(0, -1);
        pagesRef.current = trimmed;
        setPages(trimmed);
      } finally {
        loading.current.delete(next);
      }
    },
    [pages, load, pdfDocument.numPages],
  );

  useEffect(() => {
    const root = scroller();
    if (!root) return;
    const sections = root.querySelectorAll<HTMLElement>("[data-reflow-page]");
    const first = sections[0];
    const last = sections[sections.length - 1];
    if (!first || !last) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (e.target === first) void extend(-1);
          if (e.target === last) void extend(1);
        }
      },
      { root, rootMargin: `${PRELOAD_MARGIN_PX}px 0px` },
    );
    observer.observe(first);
    if (last !== first) observer.observe(last);
    return () => observer.disconnect();
  }, [pages, extend]);

  useEffect(() => {
    const bump = () => setFindVersion((v) => v + 1);
    const events = ["updatefindmatchcount", "updatefindcontrolstate", "findbarclose"];
    events.forEach((e) => eventBus.on(e, bump));
    return () => events.forEach((e) => eventBus.off(e, bump));
  }, [eventBus]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      pages.map(async ({ page, pdfPage }): Promise<[number, ItemRange[]]> => {
        if (page.kind !== "reflow") return [page.pageNumber, []];
        const rects = highlightRects(page.pageNumber, page.width, page.height);
        if (rects.length === 0) return [page.pageNumber, []];
        const key = JSON.stringify(rects);
        const cached = rangeCache.current.get(pdfPage);
        if (cached?.key === key) return [page.pageNumber, cached.ranges];
        const ranges = await highlightRanges(pdfPage, rects);
        rangeCache.current.set(pdfPage, { key, ranges });
        return [page.pageNumber, ranges];
      }),
    )
      .then((entries) => {
        if (!cancelled) setHighlightsByPage(Object.fromEntries(entries));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pages, highlightRects]);

  const [selection, setSelection] = useState<{ value: ReflowSelection; left: number; top: number } | null>(null);
  const [ghost, setGhost] = useState<ReflowSelection | null>(null);

  const selectable = Boolean(renderSelection);

  const closeSelection = useCallback(() => {
    setSelection(null);
    setGhost(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    const root = scroller();
    if (!root || !visible || !selectable) return;
    let pointerDown = false;
    let running = false;
    let dirty = false;
    let latest = 0;

    const finish = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      if (running) {
        dirty = true;
        return;
      }
      running = true;
      const id = ++latest;
      const box = range.getBoundingClientRect();
      const rootBox = root.getBoundingClientRect();
      const half = Math.min(140, rootBox.width / 2);
      const left = clamp(box.left + box.width / 2 - rootBox.left, half, rootBox.width - half);
      const top = box.top - rootBox.top + root.scrollTop;
      void selectionToPosition(selectedSlices(root, range), (n) => pdfDocument.getPage(n), viewer.currentScale)
        .then((value) => {
          if (id === latest && value) setSelection({ value, left, top });
        })
        .catch(() => undefined)
        .finally(() => {
          running = false;
          if (dirty) {
            dirty = false;
            finish();
          }
        });
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-reflow-tip]")) return;
      pointerDown = true;
      latest += 1;
      setSelection(null);
      setGhost(null);
    };
    const onUp = () => {
      if (!pointerDown) return;
      pointerDown = false;
      finish();
    };
    const onChange = () => {
      if (!pointerDown) finish();
    };
    root.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("keyup", onChange);
    document.addEventListener("selectionchange", onChange);
    return () => {
      root.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("keyup", onChange);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [visible, selectable, pdfDocument, viewer]);

  const marksByPage = useMemo(() => {
    const fc = findController;
    const marks = new Map<number, PageMarks>();
    for (const loaded of pages) {
      const index = loaded.page.pageNumber - 1;
      const active = fc?.highlightMatches && fc.pageMatches?.[index];
      marks.set(loaded.page.pageNumber, {
        search: active
          ? convertMatches(loaded.input.itemStrings, fc.pageMatches[index]!, fc.pageMatchesLength[index]!)
          : [],
        selectedSearch: active && fc.selected.pageIdx === index ? fc.selected.matchIdx : null,
        highlights: [
          ...(highlightsByPage[loaded.page.pageNumber] ?? []),
          ...(ghost?.ranges.get(loaded.page.pageNumber) ?? []),
        ],
      });
    }
    return marks;
    // pdf.js mutates findController in place; findVersion is its change signal.
  }, [pages, findController, findVersion, highlightsByPage, ghost]);

  useEffect(() => {
    const fc = findController;
    if (!visible || !fc?.highlightMatches) return;
    const pageIdx = fc.selected?.pageIdx;
    if (pageIdx === undefined || pageIdx < 0) return;
    const key = `${String(fc.state?.query)}:${pageIdx}:${fc.selected.matchIdx}`;
    if (handledFind.current === key) return;
    const root = scroller();
    const selected = root?.querySelector<HTMLElement>("mark[data-selected]");
    if (selected) {
      handledFind.current = key;
      beginProgrammaticScroll(root);
      selected.scrollIntoView({ block: "center" });
      return;
    }
    const loaded = pages.find((p) => p.page.pageNumber === pageIdx + 1);
    if (!loaded) {
      openAtPageTop(pageIdx + 1);
      return;
    }
    const matches = fc.pageMatches?.[pageIdx];
    const lengths = fc.pageMatchesLength?.[pageIdx];
    if (!root || !matches || !lengths) return;
    const range = convertMatches(loaded.input.itemStrings, matches, lengths)[fc.selected.matchIdx];
    const item = range ? loaded.input.items.find((i) => i.index === range.begin.itemIndex) : undefined;
    if (!item) return;
    const r = root.getBoundingClientRect();
    const target: ScreenAnchor = {
      point: { pageNumber: pageIdx + 1, x: item.rect.x, y: item.rect.y + item.rect.height / 2 },
      clientX: r.left,
      clientY: r.top + r.height / 2,
    };
    if (placeAnchor(target, pxPerPt)) handledFind.current = key;
  }, [findVersion, visible, findController, pages, openAtPageTop, placeAnchor, pxPerPt]);

  useEffect(() => {
    if (!visible) return;
    const onPageChanging = (e: unknown) => {
      if (syncingPage.current) return;
      const pageNumber = (e as { pageNumber?: number }).pageNumber;
      if (!pageNumber) return;
      const fc = findController;
      if (fc?.highlightMatches && fc.selected?.pageIdx === pageNumber - 1) return;
      const root = scroller();
      const section = root?.querySelector<HTMLElement>(`[data-reflow-page="${pageNumber}"]`);
      if (root && section) {
        const r = root.getBoundingClientRect();
        const s = section.getBoundingClientRect();
        if (s.bottom > r.top && s.top < r.bottom) return;
      }
      openAtPageTop(pageNumber);
    };
    eventBus.on("pagechanging", onPageChanging);
    return () => eventBus.off("pagechanging", onPageChanging);
  }, [eventBus, visible, findController, openAtPageTop]);

  useEffect(
    () => () => {
      announceReflowLayout();
    },
    [],
  );

  const revealing = useRef<number | null>(null);
  useEffect(() => {
    revealing.current = null;
    if (visible) announceReflowLayout();
  }, [visible, pages, pxPerPt]);

  useEffect(() => {
    if (!visible) return;
    const onReveal = (e: Event) => {
      const pageNumber = (e as CustomEvent<{ pageNumber: number }>).detail.pageNumber;
      if (revealing.current === pageNumber || pagesRef.current.some((p) => p.page.pageNumber === pageNumber)) return;
      revealing.current = pageNumber;
      openAtPageTop(pageNumber);
    };
    document.addEventListener(REFLOW_REVEAL_EVENT, onReveal);
    return () => document.removeEventListener(REFLOW_REVEAL_EVENT, onReveal);
  }, [visible, openAtPageTop]);

  const anchorAt = useCallback(
    (clientX: number, clientY: number): ScreenAnchor | null => {
      const root = scroller();
      if (!root) return null;
      const hit = document.elementFromPoint(clientX, clientY);
      let span = hit?.closest<HTMLElement>("[data-run]") ?? null;
      if (!span || !root.contains(span)) {
        let best: { el: HTMLElement; d: number } | null = null;
        root.querySelectorAll<HTMLElement>("[data-run]").forEach((el) => {
          const r = el.getBoundingClientRect();
          const dy = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0;
          const dx = clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0;
          const d = dy * 4 + dx;
          if (!best || d < best.d) best = { el, d };
        });
        span = (best as { el: HTMLElement } | null)?.el ?? null;
      }
      const ppt = livePxPerPt.current;
      const crop = hit?.closest<HTMLElement>("[data-crop-y]");
      const section = (crop ?? span)?.closest<HTMLElement>("[data-reflow-page]");
      const pageNumber = Number(section?.dataset.reflowPage);
      if (crop && section && root.contains(crop)) {
        const r = crop.getBoundingClientRect();
        const point: PdfPoint = {
          pageNumber,
          x: Number(crop.dataset.cropX),
          y: Number(crop.dataset.cropY) + (clientY - r.top) / (cropScale(crop) ?? ppt),
        };
        return { point, clientX: r.left, clientY };
      }
      if (!span) return sectionAnchorAt(root, clientX, clientY, ppt);
      const entry = runIndex.get(span.dataset.run ?? "");
      if (!entry) return null;
      const caret = caretAt(clientX, clientY);
      const inSpan = caret ? offsetWithin(span, caret) : null;
      const offset = entry.run.start + (inSpan ?? 0);
      const glyph = charRect(span, inSpan ?? 0) ?? span.getBoundingClientRect();
      const block = span.closest("[data-reflow-block]") ?? span;
      return {
        point: {
          pageNumber: entry.pageNumber,
          x: entry.run.rect.x,
          y: entry.run.rect.y + entry.run.rect.height / 2,
        },
        clientX: block.getBoundingClientRect().left,
        clientY: glyph.top + glyph.height / 2,
        char: { itemIndex: entry.run.itemIndex, offset },
      };
    },
    [runIndex],
  );

  const topAnchor = useCallback((): ScreenAnchor | null => {
    const root = scroller();
    if (!root) return null;
    const r = root.getBoundingClientRect();
    return anchorAt(r.left + r.width / 2, r.top + 8);
  }, [anchorAt]);

  useImperativeHandle(
    ref,
    () => ({
      anchorAt,
      topAnchor,
      showPagePoint: (pageNumber, fx, fy) => {
        void source.page(pageNumber).then((page) => {
          const root = scroller();
          if (!root) return;
          const r = root.getBoundingClientRect();
          const target: ScreenAnchor = {
            point: { pageNumber, x: fx * page.width, y: fy * page.height },
            clientX: r.left,
            clientY: r.top + r.height / 3,
          };
          const inWindow = pagesRef.current.some((p) => p.page.pageNumber === pageNumber);
          if (inWindow && placeAnchor(target, livePxPerPt.current)) return;
          void openWindow(pageNumber, target);
        });
      },
      previewScale: (next, keep) => {
        const root = scroller();
        if (!root) return;
        const ppt = next * CSS_PX_PER_PT;
        livePxPerPt.current = ppt;
        root.style.setProperty("--reflow-pt", `${ppt}px`);
        placeAnchor(keep, ppt);
      },
    }),
    [anchorAt, placeAnchor, topAnchor, source, openWindow],
  );

  useLayoutEffect(() => {
    livePxPerPt.current = pxPerPt;
    scroller()?.style.setProperty("--reflow-pt", `${pxPerPt}px`);
  }, [pxPerPt]);

  useEffect(() => {
    const root = scroller();
    if (!root || !visible) return;
    let width = root.clientWidth;
    viewTop.current = topAnchor();
    const observer = new ResizeObserver(() => {
      if (root.clientWidth === width) return;
      width = root.clientWidth;
      const keep = viewTop.current;
      if (keep) placeAnchor({ ...keep, clientY: root.getBoundingClientRect().top + 8 }, livePxPerPt.current);
      announceReflowLayout();
      onResized();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [visible, topAnchor, placeAnchor, onResized]);

  useEffect(() => {
    const root = scroller();
    if (!root || !visible) return;
    const onScroll = () => {
      viewTop.current = topAnchor();
      const r = root.getBoundingClientRect();
      const probe = r.top + Math.min(40, r.height / 4);
      for (const section of root.querySelectorAll<HTMLElement>("[data-reflow-page]")) {
        const s = section.getBoundingClientRect();
        if (s.bottom > probe) {
          const n = Number(section.dataset.reflowPage);
          if (n && viewer.currentPageNumber !== n) {
            syncingPage.current = true;
            viewer.currentPageNumber = n;
            syncingPage.current = false;
          }
          return;
        }
      }
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [viewer, visible, topAnchor]);

  return (
    <div
      ref={scrollerRef}
      className="reflow-layer"
      data-active={visible ? "" : undefined}
      style={{ visibility: visible ? "visible" : "hidden" }}
    >
      {pages.map((loaded) => (
        <ReflowPageView
          key={loaded.page.pageNumber}
          loaded={loaded}
          pxPerPt={pxPerPt}
          marks={marksByPage.get(loaded.page.pageNumber)!}
        />
      ))}
      {selection && renderSelection && (
        <div className="reflow-tip" data-reflow-tip="" style={{ left: selection.left, top: selection.top }}>
          {renderSelection(selection.value, closeSelection, () => setGhost(selection.value))}
        </div>
      )}
    </div>
  );
});

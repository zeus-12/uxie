import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfHighlighter as PdfHighlighterComponent } from "react-pdf-highlighter";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createReflowSource } from "../../../lib/reflow/source";
import type { Rect } from "../../../lib/reflow/types";
import {
  canvasAnchorAt,
  canvasPointAt,
  fitWidthScale,
  scrollCanvasTo,
  type ScreenAnchor,
} from "./canvas-anchor";
import { ReflowLayer, type ReflowLayerApi } from "./reflow-layer";

const ENTER_RATIO = 1.15;
const EXIT_RATIO = 1.02;
const MIN_SCALE = 0.25;
const MAX_SCALE = 6;

type Instance = InstanceType<typeof PdfHighlighterComponent>;

type Pinch = {
  startDistance: number;
  startScale: number;
  mode: "page" | "reflow";
  anchor: ScreenAnchor;
  origin: { x: number; y: number };
  ratio: number;
};

const coarsePointer = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

const touchDistance = (t: TouchList) =>
  Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);

const touchMid = (t: TouchList) => ({
  x: (t[0]!.clientX + t[1]!.clientX) / 2,
  y: (t[0]!.clientY + t[1]!.clientY) / 2,
});

export const useInPlaceReflow = ({
  enabled,
  instance,
  pdfDocument,
  highlightRects,
  onZoomChange,
}: {
  enabled: boolean;
  instance: Instance | null;
  pdfDocument: PDFDocumentProxy;
  highlightRects: (pageNumber: number, width: number, height: number) => Rect[];
  onZoomChange?: (scale: number) => void;
}) => {
  const source = useMemo(() => createReflowSource(pdfDocument), [pdfDocument]);
  const [reflow, setReflow] = useState<{ anchor: ScreenAnchor; scale: number } | null>(null);
  const [placed, setPlaced] = useState(false);
  const layerRef = useRef<ReflowLayerApi | null>(null);
  const pendingAnchor = useRef<ScreenAnchor | null>(null);
  const modeRef = useRef<"page" | "reflow">("page");
  const pinchRef = useRef<Pinch | null>(null);
  const entryRequest = useRef(0);
  const viewer = instance?.viewer ?? null;

  useEffect(() => {
    modeRef.current = reflow ? "reflow" : "page";
  }, [reflow]);

  const releaseTransform = useCallback(() => {
    const el = viewer?.viewer as HTMLElement | null | undefined;
    if (!el) return;
    el.style.transform = "";
    el.style.transformOrigin = "";
  }, [viewer]);

  const canvasTopAnchor = useCallback((): ScreenAnchor | null => {
    if (!viewer) return null;
    const r = viewer.container.getBoundingClientRect();
    const point = canvasPointAt(viewer, r.left + 1, r.top + 1);
    return point ? { point, clientX: r.left + 1, clientY: r.top + 1 } : null;
  }, [viewer]);

  const exitTo = useCallback(
    (anchor: ScreenAnchor | null) => {
      if (viewer && anchor) scrollCanvasTo(viewer, anchor);
      setReflow(null);
      setPlaced(false);
    },
    [viewer],
  );

  useEffect(() => {
    if (enabled) return;
    entryRequest.current += 1;
    pinchRef.current = null;
    pendingAnchor.current = null;
    releaseTransform();
    if (modeRef.current !== "reflow") return;
    modeRef.current = "page";
    exitTo(layerRef.current?.topAnchor() ?? null);
  }, [enabled, exitTo, releaseTransform]);

  useEffect(() => {
    if (!viewer || !instance || !enabled) return;
    const onScale = () => {
      entryRequest.current += 1;
      releaseTransform();
      const scale = viewer.currentScale;
      const fit = fitWidthScale(viewer);
      const anchor = pendingAnchor.current;
      pendingAnchor.current = null;
      if (!fit) return;
      if (modeRef.current === "page") {
        if (coarsePointer() && scale > fit * ENTER_RATIO) {
          const entry = anchor ?? canvasTopAnchor();
          if (!entry) return;
          if (anchor) scrollCanvasTo(viewer, anchor);
          const request = entryRequest.current;
          void source.page(entry.point.pageNumber).then((page) => {
            if (request !== entryRequest.current || modeRef.current !== "page") return;
            if (page.kind !== "reflow" || viewer.currentScale !== scale) return;
            modeRef.current = "reflow";
            setPlaced(false);
            setReflow({ anchor: entry, scale });
          });
        } else if (anchor) {
          scrollCanvasTo(viewer, anchor);
        }
        return;
      }
      if (scale < fit * EXIT_RATIO) {
        modeRef.current = "page";
        exitTo(anchor ?? layerRef.current?.topAnchor() ?? null);
        return;
      }
      const keep = anchor ?? layerRef.current?.topAnchor() ?? null;
      setReflow((current) => (current ? { anchor: keep ?? current.anchor, scale } : current));
    };
    instance.eventBus.on("scalechanging", onScale);
    return () => instance.eventBus.off("scalechanging", onScale);
  }, [viewer, instance, enabled, source, canvasTopAnchor, exitTo, releaseTransform]);

  useEffect(() => {
    const container = instance?.containerNode;
    if (!container) return;
    container.style.visibility = reflow && placed ? "hidden" : "";
  }, [instance, reflow, placed]);

  const commitScale = useCallback(
    (scale: number) => {
      if (!viewer) return;
      if (Math.abs(scale - viewer.currentScale) < 1e-3) {
        releaseTransform();
        const anchor = pendingAnchor.current;
        pendingAnchor.current = null;
        if (modeRef.current === "reflow" && anchor) {
          setReflow((current) => (current ? { anchor, scale: current.scale } : current));
        } else if (anchor) scrollCanvasTo(viewer, anchor);
        return;
      }
      releaseTransform();
      viewer.currentScale = scale;
      onZoomChange?.(viewer.currentScale);
    },
    [viewer, onZoomChange, releaseTransform],
  );

  const bindPinch = useCallback(
    (wrapper: HTMLElement | null) => {
      if (!wrapper || !viewer || !enabled) return () => undefined;
      const pdfViewerEl = viewer.viewer as HTMLElement | null;

      const start = (e: TouchEvent) => {
        if (e.touches.length !== 2) return;
        const mid = touchMid(e.touches);
        const mode = modeRef.current;
        let anchor: ScreenAnchor | null = null;
        let origin = { x: 0, y: 0 };
        if (mode === "reflow") {
          anchor = layerRef.current?.anchorAt(mid.x, mid.y) ?? null;
        } else {
          anchor = canvasAnchorAt(viewer, mid.x, mid.y);
          const box = viewer.container.getBoundingClientRect();
          const viewerBox = pdfViewerEl?.getBoundingClientRect() ?? box;
          origin = { x: mid.x - viewerBox.left, y: mid.y - viewerBox.top };
        }
        if (!anchor) return;
        e.preventDefault();
        pinchRef.current = {
          startDistance: touchDistance(e.touches),
          startScale: viewer.currentScale,
          mode,
          anchor,
          origin,
          ratio: 1,
        };
      };

      const move = (e: TouchEvent) => {
        const pinch = pinchRef.current;
        if (!pinch || e.touches.length !== 2) return;
        e.preventDefault();
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.startScale * (touchDistance(e.touches) / pinch.startDistance)));
        pinch.ratio = scale / pinch.startScale;
        if (pinch.mode === "reflow") {
          layerRef.current?.previewScale(scale, pinch.anchor);
        } else if (pdfViewerEl) {
          pdfViewerEl.style.transformOrigin = `${pinch.origin.x}px ${pinch.origin.y}px`;
          pdfViewerEl.style.transform = `scale(${pinch.ratio})`;
        }
      };

      const end = (e: TouchEvent) => {
        const pinch = pinchRef.current;
        if (!pinch || e.touches.length >= 2) return;
        pinchRef.current = null;
        const scale = pinch.startScale * pinch.ratio;
        pendingAnchor.current =
          pinch.mode === "reflow"
            ? (layerRef.current?.anchorAt(pinch.anchor.clientX, pinch.anchor.clientY) ?? pinch.anchor)
            : pinch.anchor;
        commitScale(scale);
      };

      wrapper.addEventListener("touchstart", start, { passive: false });
      wrapper.addEventListener("touchmove", move, { passive: false });
      wrapper.addEventListener("touchend", end);
      wrapper.addEventListener("touchcancel", end);
      return () => {
        wrapper.removeEventListener("touchstart", start);
        wrapper.removeEventListener("touchmove", move);
        wrapper.removeEventListener("touchend", end);
        wrapper.removeEventListener("touchcancel", end);
      };
    },
    [viewer, enabled, commitScale],
  );

  const onPlaced = useCallback(() => setPlaced(true), []);

  const layer =
    reflow && viewer && instance ? (
      <ReflowLayer
        ref={layerRef}
        source={source}
        pdfDocument={pdfDocument}
        viewer={viewer}
        findController={instance.findController as never}
        eventBus={instance.eventBus}
        scale={reflow.scale}
        anchor={reflow.anchor}
        highlightRects={highlightRects}
        visible={placed}
        onPlaced={onPlaced}
      />
    ) : null;

  return { layer, bindPinch, active: Boolean(reflow && placed) };
};

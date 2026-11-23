import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfHighlighter as PdfHighlighterComponent } from "react-pdf-highlighter";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { createReflowSource } from "../../../lib/reflow/source";
import type { Rect } from "../../../lib/reflow/types";
import {
  canvasAnchorAt,
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
  fingerX: number;
  ratio: number;
};

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
  renderSelection,
  renderHighlight,
}: {
  enabled: boolean;
  instance: Instance | null;
  pdfDocument: PDFDocumentProxy;
  highlightRects: ComponentProps<typeof ReflowLayer>["highlightRects"];
  onZoomChange?: (scale: number, persist: boolean) => void;
  renderSelection?: ComponentProps<typeof ReflowLayer>["renderSelection"];
  renderHighlight?: ComponentProps<typeof ReflowLayer>["renderHighlight"];
}) => {
  const source = useMemo(() => createReflowSource(pdfDocument), [pdfDocument]);
  const [reflow, setReflow] = useState<{ anchor: ScreenAnchor; scale: number } | null>(null);
  const [placed, setPlaced] = useState(false);
  const placedRef = useRef(false);
  placedRef.current = placed;
  const layerRef = useRef<ReflowLayerApi | null>(null);
  const pendingAnchor = useRef<ScreenAnchor | null>(null);
  const pendingZoomIn = useRef(false);
  const modeRef = useRef<"page" | "reflow">("page");
  const pinchRef = useRef<Pinch | null>(null);
  const entryRequest = useRef(0);
  const viewer = instance?.viewer ?? null;

  useEffect(() => {
    modeRef.current = reflow ? "reflow" : "page";
  }, [reflow]);

  useEffect(
    () => () => {
      entryRequest.current += 1;
      modeRef.current = "page";
      pinchRef.current = null;
      pendingAnchor.current = null;
      pendingZoomIn.current = false;
      setReflow(null);
      setPlaced(false);
    },
    [pdfDocument, viewer],
  );

  const releaseTransform = useCallback(() => {
    const el = viewer?.viewer as HTMLElement | null | undefined;
    if (!el) return;
    el.style.transform = "";
    el.style.transformOrigin = "";
  }, [viewer]);

  // A pinch that heads for reflow isn't saved; once the page shows instead, it is.
  const savePageZoom = useCallback(() => {
    if (viewer) onZoomChange?.(viewer.currentScale, true);
  }, [viewer, onZoomChange]);

  const exitTo = useCallback(
    (anchor: ScreenAnchor | null) => {
      if (viewer && anchor) scrollCanvasTo(viewer, anchor);
      setReflow(null);
      setPlaced(false);
      savePageZoom();
    },
    [viewer, savePageZoom],
  );

  useEffect(() => {
    if (enabled) return;
    entryRequest.current += 1;
    pinchRef.current = null;
    pendingAnchor.current = null;
    pendingZoomIn.current = false;
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
      const zoomedIn = pendingZoomIn.current;
      pendingAnchor.current = null;
      pendingZoomIn.current = false;
      if (!fit) return;
      if (modeRef.current === "page") {
        if (anchor && zoomedIn && scale > fit * ENTER_RATIO) {
          const entry = anchor;
          scrollCanvasTo(viewer, anchor);
          const request = entryRequest.current;
          source
            .page(entry.point.pageNumber)
            .then((page) => {
              if (request !== entryRequest.current || modeRef.current !== "page") return;
              const here = canvasAnchorAt(viewer, entry.clientX, entry.clientY);
              if (
                page.kind !== "reflow" ||
                viewer.currentScale !== scale ||
                here?.point.pageNumber !== entry.point.pageNumber
              ) {
                savePageZoom();
                return;
              }
              modeRef.current = "reflow";
              setPlaced(false);
              setReflow({ anchor: here, scale });
            })
            .catch(() => {
              if (request === entryRequest.current) savePageZoom();
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
  }, [viewer, instance, enabled, source, exitTo, releaseTransform, savePageZoom]);

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
        pendingZoomIn.current = false;
        if (modeRef.current === "reflow" && anchor) {
          setReflow((current) => (current ? { anchor, scale: current.scale } : current));
        } else if (anchor) scrollCanvasTo(viewer, anchor);
        return;
      }
      releaseTransform();
      const fit = fitWidthScale(viewer);
      const reflowAfter = Boolean(
        fit &&
          (modeRef.current === "reflow"
            ? scale >= fit * EXIT_RATIO
            : pendingZoomIn.current && pendingAnchor.current && scale > fit * ENTER_RATIO),
      );
      viewer.currentScale = scale;
      onZoomChange?.(viewer.currentScale, !reflowAfter);
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
        if (modeRef.current === "reflow" && !placedRef.current) {
          entryRequest.current += 1;
          modeRef.current = "page";
          setReflow(null);
        }
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
          fingerX: mid.x,
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
        pendingZoomIn.current = pinch.ratio > 1;
        pendingAnchor.current =
          pinch.mode === "reflow"
            ? (layerRef.current?.anchorAt(pinch.fingerX, pinch.anchor.clientY) ?? pinch.anchor)
            : pinch.anchor;
        commitScale(scale);
      };

      const cancel = () => {
        const pinch = pinchRef.current;
        if (!pinch) return;
        pinchRef.current = null;
        releaseTransform();
        if (pinch.mode === "reflow") layerRef.current?.previewScale(pinch.startScale, pinch.anchor);
      };

      wrapper.addEventListener("touchstart", start, { passive: false });
      wrapper.addEventListener("touchmove", move, { passive: false });
      wrapper.addEventListener("touchend", end);
      wrapper.addEventListener("touchcancel", cancel);
      return () => {
        wrapper.removeEventListener("touchstart", start);
        wrapper.removeEventListener("touchmove", move);
        wrapper.removeEventListener("touchend", end);
        wrapper.removeEventListener("touchcancel", cancel);
      };
    },
    [viewer, enabled, commitScale, releaseTransform],
  );

  // The reader owns pinch while reflow is on: a pinch that starts outside the PDF
  // (or WebKit's own gesture events) would otherwise zoom the whole page natively.
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const blockMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const blockGesture = (e: Event) => e.preventDefault();
    root.setAttribute("data-reflow-on-zoom", "");
    document.addEventListener("touchmove", blockMultiTouch, { passive: false });
    document.addEventListener("gesturestart", blockGesture);
    document.addEventListener("gesturechange", blockGesture);
    return () => {
      root.removeAttribute("data-reflow-on-zoom");
      document.removeEventListener("touchmove", blockMultiTouch);
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
    };
  }, [enabled]);

  const onPlaced = useCallback(() => setPlaced(true), []);
  const onResized = useCallback(() => {
    if (!viewer || modeRef.current !== "reflow") return;
    const fit = fitWidthScale(viewer);
    if (!fit || viewer.currentScale >= fit * EXIT_RATIO) return;
    modeRef.current = "page";
    exitTo(layerRef.current?.topAnchor() ?? null);
  }, [viewer, exitTo]);
  const onFailed = useCallback(() => {
    modeRef.current = "page";
    exitTo(null);
  }, [exitTo]);

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
        onFailed={onFailed}
        onResized={onResized}
        renderSelection={renderSelection}
        renderHighlight={renderHighlight}
      />
    ) : null;

  const showPagePoint = useCallback((pageNumber: number, fx: number, fy: number) => {
    layerRef.current?.showPagePoint(pageNumber, fx, fy);
  }, []);

  return { layer, bindPinch, active: Boolean(reflow && placed), showPagePoint };
};

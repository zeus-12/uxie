import { create } from "zustand";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 6;
export const ZOOM_STEP = 1.25;

export const clampZoom = (scale: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));

export type ReaderZoom = {
  zoomTo: (scale: number) => void;
  zoomBy: (factor: number) => void;
  zoomToFit: () => void;
};

// Registered by the reader while reflow-on-zoom is on, so the toolbar and keyboard
// zoom take the same path as a pinch.
export const useReaderZoomStore = create<{
  zoom: ReaderZoom | null;
  setZoom: (zoom: ReaderZoom | null) => void;
}>((set) => ({
  zoom: null,
  setZoom: (zoom) => set({ zoom }),
}));

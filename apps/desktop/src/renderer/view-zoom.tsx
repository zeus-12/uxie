import { useEffect } from "react";
import { useReaderZoomStore, ZOOM_STEP } from "@uxie/shared/lib/reader-zoom";

// View ▸ Zoom (⌘+ / ⌘− / ⌘0) zooms the reader while it owns zoom, the window otherwise.
export function ViewZoom() {
  useEffect(
    () =>
      window.uxieAPI.onViewZoom((direction) => {
        const reader = useReaderZoomStore.getState().zoom;
        if (!reader) window.uxieAPI.zoomWindow(direction);
        else if (direction === "in") reader.zoomBy(ZOOM_STEP);
        else if (direction === "out") reader.zoomBy(1 / ZOOM_STEP);
        else reader.zoomToFit();
      }),
    [],
  );
  return null;
}

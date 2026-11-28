import { type HighlightPositionType } from "@/types/highlight";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  isHighlightColor,
  type HighlightColor,
} from "@uxie/shared/lib/highlight-colors";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_DOC_SEED, type DemoDoc, type DemoHighlight } from "./seed";

export type { DemoDoc } from "./seed";

interface DemoDocStore extends DemoDoc {
  addHighlight: (highlight: DemoHighlight) => void;
  deleteHighlight: (id: string) => void;
  recolorHighlight: (id: string, color: HighlightColor) => void;
  updateAreaHighlight: (
    id: string,
    boundingRect: HighlightPositionType["boundingRect"],
    pageNumber?: number,
  ) => void;
  setNote: (note: string) => void;
  setTitle: (title: string) => void;
  setIsVectorised: (isVectorised: boolean) => void;
  setReaderState: (state: {
    lastReadPage?: number;
    zoomLevel?: number;
  }) => void;
  reset: () => void;
}

const DEMO_STORAGE_KEY = "uxie-demo-doc";

export const useDemoDocStore = create<DemoDocStore>()(
  persist(
    (set) => ({
      ...DEMO_DOC_SEED,

      addHighlight: (highlight) =>
        set((state) => ({ highlights: [...state.highlights, highlight] })),

      deleteHighlight: (id) =>
        set((state) => ({
          highlights: state.highlights.filter((h) => h.id !== id),
        })),

      recolorHighlight: (id, color) =>
        set((state) => ({
          highlights: state.highlights.map((h) =>
            h.id === id ? { ...h, color } : h,
          ),
        })),

      updateAreaHighlight: (id, boundingRect, pageNumber) =>
        set((state) => ({
          highlights: state.highlights.map((h) =>
            h.id === id
              ? {
                  ...h,
                  position: {
                    ...h.position,
                    boundingRect: { ...h.position.boundingRect, ...boundingRect },
                    ...(pageNumber ? { pageNumber } : {}),
                    rects: [],
                  },
                }
              : h,
          ),
        })),

      setNote: (note) => set({ note }),
      setTitle: (title) => set({ title }),
      setIsVectorised: (isVectorised) => set({ isVectorised }),
      setReaderState: (state) => set(state),

      reset: () => set({ ...DEMO_DOC_SEED }),
    }),
    {
      name: DEMO_STORAGE_KEY,
      version: 1,
      migrate: (persisted) => {
        const doc = persisted as DemoDoc;
        return {
          ...doc,
          highlights: (doc.highlights ?? []).map((h) => ({
            ...h,
            color: isHighlightColor(h.color) ? h.color : DEFAULT_HIGHLIGHT_COLOR,
          })),
        } as DemoDocStore;
      },
      partialize: ({
        addHighlight,
        deleteHighlight,
        recolorHighlight,
        updateAreaHighlight,
        setNote,
        setTitle,
        setIsVectorised,
        setReaderState,
        reset,
        ...doc
      }) => doc,
    },
  ),
);

/** Clears all locally-stored demo data and reseeds the document. */
export const resetDemo = () => {
  useDemoDocStore.persist.clearStorage();
  useDemoDocStore.getState().reset();
};

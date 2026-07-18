import { type HighlightPositionType } from "@/types/highlight";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_DOC_SEED, type DemoDoc, type DemoHighlight } from "./seed";

export type { DemoDoc } from "./seed";

interface DemoDocStore extends DemoDoc {
  addHighlight: (highlight: DemoHighlight) => void;
  deleteHighlight: (id: string) => void;
  updateAreaHighlight: (
    id: string,
    boundingRect: HighlightPositionType["boundingRect"],
    pageNumber?: number,
  ) => void;
  setNote: (note: string) => void;
  setTitle: (title: string) => void;
  setIsVectorised: (isVectorised: boolean) => void;
  setLastReadPage: (lastReadPage: number) => void;
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
      setLastReadPage: (lastReadPage) => set({ lastReadPage }),

      reset: () => set({ ...DEMO_DOC_SEED }),
    }),
    {
      name: DEMO_STORAGE_KEY,
      // Persist only the document data by omitting the action functions, so any
      // new data field is persisted automatically.
      partialize: ({
        addHighlight,
        deleteHighlight,
        updateAreaHighlight,
        setNote,
        setTitle,
        setIsVectorised,
        setLastReadPage,
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

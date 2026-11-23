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
  setReaderState: (state: {
    lastReadPage?: number;
    zoomLevel?: number;
  }) => void;
  reset: () => void;
  openDoc: (doc: DemoDoc) => void;
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
      setReaderState: (state) => set(state),

      reset: () => set({ ...DEMO_DOC_SEED }),
      openDoc: (doc) => set({ ...doc }),
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
        setReaderState,
        reset,
        openDoc,
        ...doc
      }) => doc,
    },
  ),
);

export const resetDemo = () => {
  useDemoDocStore.persist.clearStorage();
  useDemoDocStore.getState().reset();
};

const SAVED_DEMO_KEY = "uxie-demo-doc-before-corpus";

const docOf = (state: DemoDocStore): DemoDoc =>
  useDemoDocStore.persist.getOptions().partialize!(state) as DemoDoc;

export const openCorpusDoc = (doc: DemoDoc) => {
  const state = useDemoDocStore.getState();
  if (!state.id.startsWith("corpus:")) {
    try {
      localStorage.setItem(SAVED_DEMO_KEY, JSON.stringify(docOf(state)));
    } catch {
      return;
    }
  }
  state.openDoc(doc);
};

export const closeCorpusDoc = () => {
  if (!useDemoDocStore.getState().id.startsWith("corpus:")) return;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(SAVED_DEMO_KEY);
    localStorage.removeItem(SAVED_DEMO_KEY);
  } catch {
    saved = null;
  }
  if (saved) useDemoDocStore.getState().openDoc(JSON.parse(saved) as DemoDoc);
  else resetDemo();
};

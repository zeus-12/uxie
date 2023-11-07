import { HighlightContentType } from "@/types";
import { create } from "zustand";

type FeaturesStore = {
  inViewFeature: number | null;
  setInViewFeature: (feature: number | null) => void;
};

export const useFeatureStore = create<FeaturesStore>((set) => ({
  inViewFeature: null,
  setInViewFeature: (feature: number | null) => set({ inViewFeature: feature }),
}));

type EditorStore = {
  // replace any with actual type
  editor: any | null;
  setEditor: (editor: any) => void;
};

export const useBlocknoteEditorStore = create<EditorStore>((set) => ({
  editor: null,
  setEditor: (editor: any) => set({ editor }),
}));

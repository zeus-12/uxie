import { BlockNoteEditor } from "@blocknote/core";
import { create } from "zustand";
import { BlockNoteEditorType } from "@/types/editor";

type FeaturesStore = {
  inViewFeature: number | null;
  setInViewFeature: (feature: number | null) => void;
};

// for homescreen
export const useFeatureStore = create<FeaturesStore>((set) => ({
  inViewFeature: null,
  setInViewFeature: (feature: number | null) => set({ inViewFeature: feature }),
}));

type EditorStore = {
  editor: BlockNoteEditorType | null;
  setEditor: (editor: BlockNoteEditorType) => void;
};

export const useBlocknoteEditorStore = create<EditorStore>((set) => ({
  editor: null,
  setEditor: (editor: any) => set({ editor }),
}));

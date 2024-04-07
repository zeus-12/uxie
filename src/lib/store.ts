import { BlockNoteEditorType } from "@/types/editor";
import { create } from "zustand";

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

interface ChatMessageStore {
  sendMessage: null | ((message: string) => void);
  setSendMessage: (sendMessage: (message: string) => void) => void;
}
export const useChatStore = create<ChatMessageStore>((set) => ({
  sendMessage: null,
  setSendMessage: (sendMessage: (message: string) => void) =>
    set({ sendMessage }),
}));

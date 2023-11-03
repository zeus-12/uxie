import { create } from "zustand";

type FeaturesStore = {
  inViewFeature: number | null;
  setInViewFeature: (feature: number | null) => void;
};

export const useFeatureStore = create<FeaturesStore>((set) => ({
  inViewFeature: null,
  setInViewFeature: (feature: number | null) => set({ inViewFeature: feature }),
}));

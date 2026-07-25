import { create } from "zustand";

// Every store shared with desktop lives in @uxie/shared/lib/store. Re-exported
// here so the existing "@/lib/store" call sites keep working — and, crucially,
// so web and the shared components it renders touch the *same* store instance
// (two `create()` calls persisting to one key would silently fight).
export {
  DEFAULT_SIDEBAR_TAB,
  SIDEBAR_TABS,
  useBlocknoteEditorStore,
  useChatStore,
  useCitationHighlightStore,
  useHighlightJumpStore,
  useMobileSidebarStore,
  usePdfSettingsStore,
  useSidebarTabStore,
  type SidebarTab,
} from "@uxie/shared/lib/store";

type FeaturesStore = {
  inViewFeature: number | null;
  setInViewFeature: (feature: number | null) => void;
};

// for homescreen — web only
export const useFeatureStore = create<FeaturesStore>((set) => ({
  inViewFeature: null,
  setInViewFeature: (feature: number | null) => set({ inViewFeature: feature }),
}));

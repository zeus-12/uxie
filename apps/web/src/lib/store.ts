import { PDF_BACKGROUND_COLOURS } from "@/lib/constants";
import { type BlockNoteEditorType } from "@/types/editor";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getEngineFromVoice, type TTSEngineType, type TTSVoiceId } from "./tts";
import { BROWSER_VOICES } from "./tts/providers/browser-provider";

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
  setEditor: (editor) => set({ editor }),
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

interface PdfSettingsStore {
  linksDisabled: boolean;
  toggleLinksDisabled: () => void;
  setLinksDisabled: (disabled: boolean) => void;

  bionicReadingEnabled: boolean;
  toggleBionicReading: () => void;

  sidebarHidden: boolean;
  toggleSidebar: () => void;

  speakAlongEnabled: boolean;
  setSpeakAlongEnabled: (enabled: boolean) => void;

  voice: TTSVoiceId;
  setVoice: (voice: TTSVoiceId) => void;
  getTtsEngine: () => TTSEngineType;

  rsvpOpen: boolean;
  setRsvpOpen: (open: boolean) => void;
  rsvpWpm: number;
  setRsvpWpm: (wpm: number) => void;

  pageColour: string;
  setPageColour: (colour: string) => void;
}

export const usePdfSettingsStore = create<PdfSettingsStore>()(
  persist(
    (set, get) => ({
      linksDisabled: false,
      toggleLinksDisabled: () =>
        set((state) => ({ linksDisabled: !state.linksDisabled })),
      setLinksDisabled: (disabled) => set({ linksDisabled: disabled }),

      bionicReadingEnabled: false,
      toggleBionicReading: () =>
        set((state) => ({ bionicReadingEnabled: !state.bionicReadingEnabled })),

      sidebarHidden: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarHidden: !state.sidebarHidden })),

      speakAlongEnabled: false,
      setSpeakAlongEnabled: (enabled) => set({ speakAlongEnabled: enabled }),

      voice: BROWSER_VOICES[0]?.id,
      setVoice: (voice) => set({ voice }),
      getTtsEngine: () => getEngineFromVoice(get().voice),

      rsvpOpen: false,
      setRsvpOpen: (open) => set({ rsvpOpen: open }),
      rsvpWpm: 300,
      setRsvpWpm: (wpm) => set({ rsvpWpm: wpm }),

      pageColour: PDF_BACKGROUND_COLOURS[0],
      setPageColour: (colour) => set({ pageColour: colour }),
    }),
    { name: "pdf-settings" },
  ),
);

interface CitationHighlightStore {
  highlightSource: ((pageNumber: number, text: string) => void) | null;
  setHighlightSource: (fn: (pageNumber: number, text: string) => void) => void;
}

export const useCitationHighlightStore = create<CitationHighlightStore>(
  (set) => ({
    highlightSource: null,
    setHighlightSource: (fn) => set({ highlightSource: fn }),
  }),
);

interface MobileSidebarStore {
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

export const useMobileSidebarStore = create<MobileSidebarStore>((set) => ({
  isDrawerOpen: false,
  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
}));

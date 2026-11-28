import { PDF_BACKGROUND_COLOURS } from "./constants";
import { type BlockNoteEditorType } from "../types/editor";
import { type RetrievedChunk } from "./chat";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getEngineFromVoice, type TTSEngineType, type TTSVoiceId } from "./tts";
import { BROWSER_VOICES } from "./tts/providers/browser-provider";
import { DEFAULT_HIGHLIGHT_COLOR, type HighlightColor } from "./highlight-colors";

type EditorStore = {
  editor: BlockNoteEditorType | null;
  setEditor: (editor: BlockNoteEditorType) => void;
  releaseEditor: (editor: BlockNoteEditorType) => void;
};

export const useBlocknoteEditorStore = create<EditorStore>((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
  releaseEditor: (editor) =>
    set((state) => (state.editor === editor ? { editor: null } : state)),
}));

interface ChatMessageStore {
  sendMessage: null | ((message: string) => void);
  setSendMessage: (sendMessage: ((message: string) => void) | null) => void;
  stageImageAttachment: null | ((dataUrl: string) => void);
  setStageImageAttachment: (
    stageImageAttachment: ((dataUrl: string) => void) | null,
  ) => void;
  focusInput: null | (() => void);
  setFocusInput: (focusInput: (() => void) | null) => void;
}
export const useChatStore = create<ChatMessageStore>((set) => ({
  sendMessage: null,
  setSendMessage: (sendMessage) => set({ sendMessage }),
  stageImageAttachment: null,
  setStageImageAttachment: (stageImageAttachment) =>
    set({ stageImageAttachment }),
  focusInput: null,
  setFocusInput: (focusInput) => set({ focusInput }),
}));

export type PageColour = (typeof PDF_BACKGROUND_COLOURS)[number] | "theme";

// "#FFF" was the only page colour while the app was light-only; "theme" is still white in light.
function migratePageColour(stored: unknown): PageColour {
  return (
    PDF_BACKGROUND_COLOURS.find(
      (colour) => colour === stored && colour !== PDF_BACKGROUND_COLOURS[0],
    ) ?? "theme"
  );
}

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

  pageColour: PageColour;
  setPageColour: (colour: PageColour) => void;

  reflowOnZoom: boolean;
  setReflowOnZoom: (enabled: boolean) => void;

  highlightColor: HighlightColor;
  setHighlightColor: (color: HighlightColor) => void;
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

      pageColour: "theme",
      setPageColour: (colour) => set({ pageColour: colour }),

      reflowOnZoom: false,
      setReflowOnZoom: (enabled) => set({ reflowOnZoom: enabled }),

      highlightColor: DEFAULT_HIGHLIGHT_COLOR,
      setHighlightColor: (color) => set({ highlightColor: color }),
    }),
    {
      name: "pdf-settings",
      version: 1,
      migrate: (persisted) => {
        const state = persisted as PdfSettingsStore;
        return { ...state, pageColour: migratePageColour(state.pageColour) };
      },
    },
  ),
);

export type ArticleFontFamily = "sans" | "serif" | "mono";
export type ArticleFontSize = 16 | 18 | 20 | 22;
export type ArticleBackgroundColour = PageColour;

interface ArticleSettingsStore {
  fontFamily: ArticleFontFamily;
  setFontFamily: (fontFamily: ArticleFontFamily) => void;
  fontSize: ArticleFontSize;
  setFontSize: (fontSize: ArticleFontSize) => void;
  backgroundColour: ArticleBackgroundColour;
  setBackgroundColour: (backgroundColour: ArticleBackgroundColour) => void;
}

export const useArticleSettingsStore = create<ArticleSettingsStore>()(
  persist(
    (set) => ({
      fontFamily: "sans",
      setFontFamily: (fontFamily) => set({ fontFamily }),
      fontSize: 18,
      setFontSize: (fontSize) => set({ fontSize }),
      backgroundColour: "theme",
      setBackgroundColour: (backgroundColour) => set({ backgroundColour }),
    }),
    {
      name: "article-settings",
      version: 1,
      migrate: (persisted) => {
        const state = persisted as ArticleSettingsStore;
        return {
          ...state,
          backgroundColour: migratePageColour(state.backgroundColour),
        };
      },
    },
  ),
);

type JumpToHighlight = (
  highlightId: string,
  fallbackPageNumber?: number,
) => void;

interface HighlightColorStore {
  colors: ReadonlyMap<string, HighlightColor>;
  setColors: (colors: ReadonlyMap<string, HighlightColor>) => void;
}

export const useHighlightColorStore = create<HighlightColorStore>((set) => ({
  colors: new Map(),
  setColors: (colors) => set({ colors }),
}));

export function usePublishHighlightColors(
  highlights: ReadonlyArray<{ id: string; color: HighlightColor }>,
) {
  const colors = useMemo(
    () => new Map(highlights.map((h) => [h.id, h.color])),
    [highlights],
  );
  const setColors = useHighlightColorStore((s) => s.setColors);
  useEffect(() => setColors(colors), [colors, setColors]);
  useEffect(() => () => setColors(new Map()), [setColors]);
  return colors;
}

interface HighlightJumpStore {
  jumpToHighlight: JumpToHighlight | null;
  setJumpToHighlight: (fn: JumpToHighlight | null) => void;
}

export const useHighlightJumpStore = create<HighlightJumpStore>((set) => ({
  jumpToHighlight: null,
  setJumpToHighlight: (jumpToHighlight) => set({ jumpToHighlight }),
}));

type ShowSource = (source: RetrievedChunk) => void;

interface CitationHighlightStore {
  highlightSource: ShowSource | null;
  setHighlightSource: (fn: ShowSource | null) => void;
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

export const SIDEBAR_TABS = ["notes", "chat", "flashcards"] as const;
export type SidebarTab = (typeof SIDEBAR_TABS)[number];
export const DEFAULT_SIDEBAR_TAB: SidebarTab = "notes";

interface SidebarTabStore {
  tab: SidebarTab;
  setTab: (tab: SidebarTab) => void;
}

export const useSidebarTabStore = create<SidebarTabStore>()(
  persist(
    (set) => ({
      tab: DEFAULT_SIDEBAR_TAB,
      setTab: (tab) => set({ tab }),
    }),
    { name: "sidebar-tab" },
  ),
);

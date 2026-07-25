import { PDF_BACKGROUND_COLOURS } from "./constants";
import { type BlockNoteEditorType } from "../types/editor";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getEngineFromVoice, type TTSEngineType, type TTSVoiceId } from "./tts";
import { BROWSER_VOICES } from "./tts/providers/browser-provider";

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
  // The chat input registers a focuser so ⌘L / the chat tab can focus it.
  focusInput: null | (() => void);
  setFocusInput: (focusInput: (() => void) | null) => void;
}
export const useChatStore = create<ChatMessageStore>((set) => ({
  sendMessage: null,
  setSendMessage: (sendMessage: (message: string) => void) =>
    set({ sendMessage }),
  focusInput: null,
  setFocusInput: (focusInput) => set({ focusInput }),
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

type JumpToHighlight = (
  highlightId: string,
  /** From the note block, used when the highlight itself no longer exists. */
  fallbackPageNumber?: number,
) => void;

interface HighlightJumpStore {
  // The reader registers this once its PDF viewer is ready; the highlight
  // blocks in the notes editor call it to jump to their highlight.
  jumpToHighlight: JumpToHighlight | null;
  setJumpToHighlight: (fn: JumpToHighlight | null) => void;
}

export const useHighlightJumpStore = create<HighlightJumpStore>((set) => ({
  jumpToHighlight: null,
  setJumpToHighlight: (jumpToHighlight) => set({ jumpToHighlight }),
}));

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

// The reader sidebar's tabs — the single source of truth for their names and
// order. The sidebar UI, the store default, and web's URL sync all read from here.
export const SIDEBAR_TABS = ["notes", "chat", "flashcards"] as const;
export type SidebarTab = (typeof SIDEBAR_TABS)[number];
export const DEFAULT_SIDEBAR_TAB: SidebarTab = "notes";

interface SidebarTabStore {
  tab: SidebarTab;
  setTab: (tab: SidebarTab) => void;
}

// Persisted so the reader reopens on the tab you left it on — including across
// app restarts (desktop). Web treats the URL (?tab=) as the source of truth on
// mount, so the rehydrated value there is immediately overwritten; harmless.
export const useSidebarTabStore = create<SidebarTabStore>()(
  persist(
    (set) => ({
      tab: DEFAULT_SIDEBAR_TAB,
      setTab: (tab) => set({ tab }),
    }),
    { name: "sidebar-tab" },
  ),
);

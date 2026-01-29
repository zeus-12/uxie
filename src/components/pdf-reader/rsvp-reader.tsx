import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRsvpReader } from "@/hooks/use-rsvp-reader";
import { usePdfSettingsStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  Square,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

const WPM_PRESETS = [
  { value: 200, label: "200 wpm" },
  { value: 250, label: "250 wpm" },
  { value: 300, label: "300 wpm" },
  { value: 450, label: "450 wpm" },
  { value: 500, label: "500 wpm" },
];

type RsvpReaderProps = {
  pageNumber: number;
  pageCount: number;
};

// ORP lookup table based on word length (from speedread implementation)
// This positions the focus point slightly left of center for optimal recognition
const ORP_TABLE = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3];

function getOrpIndex(word: string): number {
  const len = word.length;
  if (len > 13) return 4;
  return ORP_TABLE[len] ?? 0;
}

function WordDisplay({ word }: { word: string | null }) {
  if (!word) {
    return (
      <div className="flex items-center justify-center h-12">
        <span className="text-muted-foreground text-lg">Press play to start</span>
      </div>
    );
  }

  const orpIndex = getOrpIndex(word);
  const before = word.slice(0, orpIndex);
  const orpChar = word[orpIndex] || "";
  const after = word.slice(orpIndex + 1);

  return (
    <div className="relative w-full h-12 flex items-center">
      <div
        className="absolute text-3xl font-mono whitespace-nowrap"
        style={{
          left: "50%",
          // offset by: chars before ORP + half the ORP char width
          transform: `translateX(calc(-${before.length}ch - 0.5ch))`,
        }}
      >
        <span>{before}</span>
        <span className="text-orange-500 font-bold">{orpChar}</span>
        <span>{after}</span>
      </div>
    </div>
  );
}

type Shortcut = {
  label: string;
  displayKey: string;
  hotkey: string;
};

const SHORTCUTS = [
  { label: "Play / Pause", displayKey: "Space", hotkey: "space" },
  { label: "Previous word", displayKey: "←", hotkey: "arrowleft" },
  { label: "Next word", displayKey: "→", hotkey: "arrowright" },
  { label: "Increase speed", displayKey: "↑", hotkey: "arrowup" },
  { label: "Decrease speed", displayKey: "↓", hotkey: "arrowdown" },
  { label: "Follow along", displayKey: "F", hotkey: "f" },
  { label: "Close", displayKey: "Esc", hotkey: "escape" },
] as const satisfies Shortcut[];

type Hotkey = (typeof SHORTCUTS[number])["hotkey"]

function ShortcutsTooltip() {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <InfoIcon size={16} className="text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="p-3 max-w-[280px]">
          <p className="font-medium text-sm mb-2">Keyboard Shortcuts</p>
          <div className="grid gap-1.5 text-xs">
            {SHORTCUTS.map(({ label, displayKey }) => (
              <div key={displayKey} className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{label}</span>
                <Kbd>{displayKey}</Kbd>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function WpmDropdown({
  wpm,
  onWpmChange,
}: {
  wpm: number;
  onWpmChange: (wpm: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 min-w-[100px]"
      >
        <span>{wpm} wpm</span>
        <ChevronDownIcon
          size={14}
          className={cn(
            "transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </Button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 bg-background border rounded-lg shadow-lg overflow-hidden"
          >
            {WPM_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => {
                  onWpmChange(preset.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-4 py-2 text-sm text-left hover:bg-muted/50 transition-colors",
                  wpm === preset.value && "bg-primary/10"
                )}
              >
                {preset.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RsvpReader({ pageNumber, pageCount }: RsvpReaderProps) {
  const rsvpOpen = usePdfSettingsStore((state) => state.rsvpOpen);
  const rsvpWpm = usePdfSettingsStore((state) => state.rsvpWpm);
  const setRsvpWpm = usePdfSettingsStore((state) => state.setRsvpWpm);

  const {
    currentWord,
    isPlaying,
    isInitialized,
    togglePlay,
    stop,
    close,
    prevWord,
    nextWord,
    startFromPage,
    followAlongEnabled,
    toggleFollowAlong,
  } = useRsvpReader({ pageCount });

  useEffect(() => {
    if (rsvpOpen && !isInitialized) {
      startFromPage(pageNumber);
    }
  }, [rsvpOpen, isInitialized, pageNumber, startFromPage]);

  const cycleWpm = (direction: "up" | "down") => {
    const currentIdx = WPM_PRESETS.findIndex((p) => p.value === rsvpWpm);
    if (direction === "up" && currentIdx < WPM_PRESETS.length - 1) {
      setRsvpWpm(WPM_PRESETS[currentIdx + 1]?.value ?? rsvpWpm);
    } else if (direction === "down" && currentIdx > 0) {
      setRsvpWpm(WPM_PRESETS[currentIdx - 1]?.value ?? rsvpWpm);
    }
  };

  const hotkeyActions: Record<Hotkey, (e?: KeyboardEvent) => void> = {
    space: (e) => { e?.preventDefault(); togglePlay(); },
    arrowleft: prevWord,
    arrowright: nextWord,
    arrowup: () => cycleWpm("up"),
    arrowdown: () => cycleWpm("down"),
    f: toggleFollowAlong,
    escape: close,
  };

  useHotkeys(
    SHORTCUTS.map((s) => s.hotkey).join(","),
    (e, handler) => {
      const hotkey = (handler.keys?.join("") ?? "") as Hotkey;
      hotkeyActions[hotkey]?.(e);
    },
    { enabled: rsvpOpen }
  );

  if (!rsvpOpen) return null;

  const PLAYBACK_CONTROLS = [
    { key: "prev", onClick: prevWord, icon: <ChevronLeftIcon size={18} />, title: undefined, variant: "ghost" },
    { key: "playpause", onClick: togglePlay, icon: isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />, title: undefined, variant: "ghost" },
    { key: "next", onClick: nextWord, icon: <ChevronRightIcon size={18} />, title: undefined, variant: "ghost" },
    { key: "stop", onClick: stop, icon: <Square size={14} />, title: "Stop and reset", variant: "ghost" },
    { key: "follow", onClick: toggleFollowAlong, icon: <EyeIcon size={16} />, title: followAlongEnabled ? "Follow along (on)" : "Follow along (off)", variant: (followAlongEnabled ? "default" : "ghost") },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{
        duration: 0.25,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="mb-2 w-[400px]"
    >
      <div className="bg-background border rounded-xl shadow-xl overflow-hidden">
        <div className="relative px-6 py-8 flex items-center justify-center min-h-[100px]">
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-orange-500/20" />

          <button
            onClick={close}
            className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <XIcon size={16} className="text-muted-foreground" />
          </button>

          <WordDisplay word={currentWord} />
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t">
          <div className="flex items-center gap-1">
            {PLAYBACK_CONTROLS.map(({ key, onClick, icon, title, variant }) => (
              <Button
                key={key}
                variant={variant}
                size="sm"
                onClick={onClick}
                className="h-8 w-8 p-0"
                title={title}
              >
                {icon}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ShortcutsTooltip />
            <WpmDropdown wpm={rsvpWpm} onWpmChange={setRsvpWpm} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

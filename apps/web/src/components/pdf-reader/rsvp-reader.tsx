import {
  FloatingPanel,
  FloatingPanelBody,
  FloatingPanelFooter,
  FloatingPanelIconButton,
} from "@/components/pdf-reader/floating-panel";
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

// ORP lookup table based on word length - this positions the focus point slightly left of center for optimal recognition (from https://github.com/pasky/speedread)
const ORP_TABLE = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3];

export function getOrpIndex(word: string): number {
  const len = word.length;
  if (len > 13) return 4;
  return ORP_TABLE[len] ?? 0;
}

function WordDisplay({ word }: { word: string | null }) {
  if (!word) {
    return (
      <div className="flex items-center justify-center h-12">
        <span className="text-muted-foreground text-lg">
          Press play to start
        </span>
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

type Hotkey = (typeof SHORTCUTS)[number]["hotkey"];

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
              <div
                key={displayKey}
                className="flex items-center justify-between gap-4"
              >
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
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
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
          className={cn("transition-transform", isOpen && "rotate-180")}
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
                  wpm === preset.value && "bg-primary/10",
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
    togglePlay,
    stop,
    close,
    prevWord,
    nextWord,
    startFromPage,
    followAlongEnabled,
    toggleFollowAlong,
  } = useRsvpReader({ pageCount, pageNumber });

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!rsvpOpen) {
      hasInitializedRef.current = false;
      return;
    }
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      startFromPage(pageNumber);
    }
  }, [rsvpOpen, pageNumber, startFromPage]);

  const cycleWpm = (direction: "up" | "down") => {
    const currentIdx = WPM_PRESETS.findIndex((p) => p.value === rsvpWpm);
    if (direction === "up" && currentIdx < WPM_PRESETS.length - 1) {
      setRsvpWpm(WPM_PRESETS[currentIdx + 1]?.value ?? rsvpWpm);
    } else if (direction === "down" && currentIdx > 0) {
      setRsvpWpm(WPM_PRESETS[currentIdx - 1]?.value ?? rsvpWpm);
    }
  };

  const hotkeyActions: Record<Hotkey, (e?: KeyboardEvent) => void> = {
    space: (e) => {
      e?.preventDefault();
      togglePlay();
    },
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
    { enabled: rsvpOpen },
  );

  if (!rsvpOpen) return null;

  const playbackControls = [
    { key: "prev", onClick: prevWord, icon: <ChevronLeftIcon size={18} /> },
    {
      key: "playpause",
      onClick: togglePlay,
      icon: isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />,
    },
    { key: "next", onClick: nextWord, icon: <ChevronRightIcon size={18} /> },
    {
      key: "stop",
      onClick: stop,
      icon: <Square size={14} />,
      title: "Stop and reset",
    },
    {
      key: "follow",
      onClick: toggleFollowAlong,
      icon: <EyeIcon size={16} />,
      title: followAlongEnabled ? "Follow along (on)" : "Follow along (off)",
      active: followAlongEnabled,
    },
  ];

  return (
    <FloatingPanel open={rsvpOpen} onClose={close}>
      <FloatingPanelBody className="py-8">
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-orange-500/20" />
        <WordDisplay word={currentWord} />
      </FloatingPanelBody>

      <FloatingPanelFooter>
        <div className="flex items-center gap-1">
          {playbackControls.map(({ key, onClick, icon, title, active }) => (
            <FloatingPanelIconButton
              key={key}
              onClick={onClick}
              icon={icon}
              title={title}
              active={active}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ShortcutsTooltip />
          <WpmDropdown wpm={rsvpWpm} onWpmChange={setRsvpWpm} />
        </div>
      </FloatingPanelFooter>
    </FloatingPanel>
  );
}

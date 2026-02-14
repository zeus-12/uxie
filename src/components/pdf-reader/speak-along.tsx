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
import { useSpeakAlong } from "@/hooks/use-speak-along";
import { usePdfSettingsStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  Loader2Icon,
  MicIcon,
  Square,
  Volume2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export enum SPEAK_ALONG_STATUS {
  IDLE = "IDLE",
  LISTENING = "LISTENING",
  PAUSED = "PAUSED",
  UNSUPPORTED = "UNSUPPORTED",
  ERROR = "ERROR",
}

const SHORTCUTS = [
  { label: "Toggle mic", displayKey: "Space", hotkey: "space" },
  { label: "Previous word", displayKey: "←", hotkey: "arrowleft" },
  { label: "Next word", displayKey: "→", hotkey: "arrowright" },
  { label: "Hear word", displayKey: "Enter", hotkey: "enter" },
  { label: "Stop", displayKey: "Esc", hotkey: "escape" },
] as const;

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

type TranscriptItem = {
  id: number;
  text: string;
};

function TranscriptHistory({ items }: { items: TranscriptItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 min-h-[24px] mt-4">
      {items.map((item) => (
        <motion.span
          key={item.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground"
        >
          {item.text}
        </motion.span>
      ))}
    </div>
  );
}

export function SpeakAlong({
  pageNumber,
  pageCount,
}: {
  pageNumber: number;
  pageCount: number;
}) {
  const speakAlongEnabled = usePdfSettingsStore(
    (state) => state.speakAlongEnabled,
  );
  const setSpeakAlongEnabled = usePdfSettingsStore(
    (state) => state.setSpeakAlongEnabled,
  );

  const {
    status,
    currentWord,
    isListening,
    lastHeard,
    wordDefinition,
    isLoadingDefinition,
    showDefinition,
    start,
    stop,
    previousWord,
    nextWord,
    speakCurrentWord,
    updatePage,
    toggleDefinition,
  } = useSpeakAlong({ pageCount });

  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptItem[]>(
    [],
  );
  const transcriptIdRef = useRef(0);
  const lastHeardRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastHeard || lastHeard === lastHeardRef.current) return;
    lastHeardRef.current = lastHeard;

    const id = ++transcriptIdRef.current;
    const newItem: TranscriptItem = { id, text: lastHeard };

    setTranscriptHistory((prev) => [...prev.slice(-4), newItem]);

    const timeout = setTimeout(() => {
      setTranscriptHistory((prev) => prev.filter((item) => item.id !== id));
    }, 4000);

    return () => clearTimeout(timeout);
  }, [lastHeard]);

  const updatePageRef = useRef(updatePage);
  updatePageRef.current = updatePage;

  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => {
    if (!speakAlongEnabled) return;
    if (status === SPEAK_ALONG_STATUS.LISTENING) {
      updatePageRef.current(pageNumber);
    }
  }, [speakAlongEnabled, pageNumber, status]);

  useEffect(() => {
    if (!speakAlongEnabled) return;
    return () => {
      stopRef.current();
    };
  }, [speakAlongEnabled]);

  const isActive = status === SPEAK_ALONG_STATUS.LISTENING;

  const handleClose = () => {
    stop();
    setSpeakAlongEnabled(false);
  };

  const handleToggle = () => {
    if (isActive) {
      stop();
    } else {
      start(pageNumber);
    }
  };

  const hotkeyActions: Record<Hotkey, (e?: KeyboardEvent) => void> = {
    space: (e) => {
      e?.preventDefault();
      handleToggle();
    },
    arrowleft: () => {
      if (isActive) previousWord();
    },
    arrowright: () => {
      if (isActive) nextWord();
    },
    enter: (e) => {
      e?.preventDefault();
      if (currentWord) speakCurrentWord();
    },
    escape: handleClose,
  };

  useHotkeys(
    SHORTCUTS.map((s) => s.hotkey).join(","),
    (e, handler) => {
      const hotkey = (handler.keys?.join("") ?? "") as Hotkey;
      hotkeyActions[hotkey]?.(e);
    },
    { enabled: speakAlongEnabled },
  );

  const OPTIONS = [
    {
      key: "prev",
      onClick: previousWord,
      icon: <ChevronLeftIcon size={18} />,
      disabled: !isActive,
    },
    {
      key: "mic",
      onClick: handleToggle,
      icon: <MicIcon size={18} />,
      active: isListening,
      title: isActive ? "Stop" : "Start",
    },
    {
      key: "next",
      onClick: nextWord,
      icon: <ChevronRightIcon size={18} />,
      disabled: !isActive,
    },
    {
      key: "stop",
      onClick: stop,
      icon: <Square size={14} />,
      title: "Stop and reset",
      disabled: !isActive,
    },
  ];

  return (
    <AnimatePresence>
      {speakAlongEnabled && (
        <FloatingPanel open={speakAlongEnabled} onClose={handleClose}>
          <FloatingPanelBody>
            {/* Current word with speaker button */}
            <div className="flex items-center justify-center gap-3">
              {currentWord ? (
                <>
                  <span className="text-3xl font-semibold">{currentWord}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={speakCurrentWord}
                      className="h-8 w-8 p-0"
                      title="Hear pronunciation (Enter)"
                    >
                      <Volume2Icon
                        size={18}
                        className="text-muted-foreground"
                      />
                    </Button>

                    <TooltipProvider>
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={showDefinition ? "secondary" : "ghost"}
                            size="sm"
                            onClick={toggleDefinition}
                            className="h-8 w-8 p-0"
                          >
                            {showDefinition && isLoadingDefinition ? (
                              <Loader2Icon
                                size={16}
                                className="animate-spin text-muted-foreground"
                              />
                            ) : (
                              <InfoIcon
                                size={16}
                                className="text-muted-foreground"
                              />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">Look up definition</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground text-lg">
                  Press mic to start
                </span>
              )}
            </div>

            {/* Word definition */}
            <AnimatePresence>
              {showDefinition && wordDefinition && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 text-center overflow-hidden"
                >
                  {wordDefinition.phonetic && (
                    <p className="text-sm text-muted-foreground mb-1">
                      {wordDefinition.phonetic}
                    </p>
                  )}
                  {wordDefinition.meanings[0] && (
                    <div className="text-sm">
                      <span className="text-xs text-muted-foreground italic">
                        {wordDefinition.meanings[0].partOfSpeech}
                      </span>
                      {wordDefinition.meanings[0].definitions[0] && (
                        <p className="mt-1 text-foreground/80">
                          {wordDefinition.meanings[0].definitions[0].definition}
                        </p>
                      )}
                      {wordDefinition.meanings[0].definitions[0]?.example && (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          &ldquo;{wordDefinition.meanings[0].definitions[0].example}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Listening indicator */}
            {isActive && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isListening
                      ? "bg-red-500 animate-pulse"
                      : "bg-muted-foreground"
                  }`}
                />
                <span className="text-xs text-muted-foreground">
                  {isListening ? "Listening..." : "Paused"}
                </span>
              </div>
            )}

            {/* Transcript history */}
            <TranscriptHistory items={transcriptHistory} />
          </FloatingPanelBody>

          <FloatingPanelFooter>
            <div className="flex items-center gap-1">
              {OPTIONS.map(
                ({ key, onClick, icon, title, active, disabled }) => (
                  <FloatingPanelIconButton
                    key={key}
                    onClick={onClick}
                    icon={icon}
                    title={title}
                    active={active}
                    disabled={disabled}
                  />
                ),
              )}
            </div>
            <div className="flex items-center gap-2">
              <ShortcutsTooltip />
            </div>
          </FloatingPanelFooter>
        </FloatingPanel>
      )}
    </AnimatePresence>
  );
}

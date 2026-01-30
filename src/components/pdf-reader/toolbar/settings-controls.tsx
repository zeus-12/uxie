import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePdfSettingsStore } from "@/lib/store";
import { getEngineFromVoice, type TTSVoiceId } from "@/lib/tts";
import { BROWSER_VOICES } from "@/lib/tts/providers/browser-provider";
import { KOKORO_VOICES } from "@/lib/tts/providers/kokoro-provider";
import type { TTSVoice } from "@/lib/tts/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { BotIcon, GlobeIcon, SettingsIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useOnClickOutside } from "usehooks-ts";

interface SettingOption {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
}

const SettingsIconComponent = ({ active }: { active: boolean }) => (
  <Button variant="ghost" size="xs" className="block">
    <SettingsIcon size={20} className={cn(active && "text-foreground")} />
  </Button>
);

const LOCAL_VOICES = KOKORO_VOICES;

export const SettingsControls = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const linksDisabled = usePdfSettingsStore((state) => state.linksDisabled);
  const toggleLinksDisabled = usePdfSettingsStore(
    (state) => state.toggleLinksDisabled,
  );
  const bionicReadingEnabled = usePdfSettingsStore(
    (state) => state.bionicReadingEnabled,
  );
  const toggleBionicReading = usePdfSettingsStore(
    (state) => state.toggleBionicReading,
  );
  const voice = usePdfSettingsStore((state) => state.voice);
  const setVoice = usePdfSettingsStore((state) => state.setVoice);
  const rsvpOpen = usePdfSettingsStore((state) => state.rsvpOpen);
  const setRsvpOpen = usePdfSettingsStore((state) => state.setRsvpOpen);

  useOnClickOutside(containerRef, (e) => {
    if (iconRef.current?.contains(e.target as Node)) {
      return;
    }
    setIsOpen(false);
  });

  const settingsOptions: SettingOption[] = [
    {
      id: "disable-links",
      label: "Disable PDF links",
      enabled: linksDisabled,
      onToggle: toggleLinksDisabled,
    },
    {
      id: "bionic-reading",
      label: "Bionic reading (BETA)",
      description: "If it overlaps, try increasing the zoom.",
      enabled: bionicReadingEnabled,
      onToggle: toggleBionicReading,
    },
    {
      id: "speed-read",
      label: "Speed Read",
      description: "RSVP word-by-word reader",
      enabled: rsvpOpen,
      onToggle: () => setRsvpOpen(!rsvpOpen),
    },
  ];

  const hasActiveSettings =
    settingsOptions.some((opt) => opt.enabled) ||
    getEngineFromVoice(voice) === "local";

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        ref={iconRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="flex h-full w-full items-center justify-center"
      >
        <SettingsIconComponent active={hasActiveSettings} />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{
              duration: 0.2,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="absolute bottom-full mb-3 left-0 z-[99]"
            ref={containerRef}
          >
            <div className="rounded-lg border bg-background shadow-lg divide-y">
              {settingsOptions.map((option) => (
                <SettingToggleOption key={option.id} option={option} />
              ))}

              <div className="px-4 py-3">
                <span className="text-sm text-gray-800 tracking-wide block mb-2">
                  Text to Speech
                </span>

                <div className="space-y-1">
                  <VoiceSelector
                    voices={BROWSER_VOICES}
                    icon={GlobeIcon}
                    title="Browser"
                    description="Fast, lower quality"
                    selectedVoice={voice}
                    onSelect={setVoice}
                  />
                  <VoiceSelector
                    voices={LOCAL_VOICES}
                    icon={BotIcon}
                    title="AI Models"
                    description="First load takes time, better quality"
                    selectedVoice={voice}
                    onSelect={setVoice}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const VoiceSelector = ({
  voices,
  icon: Icon,
  title,
  description,
  selectedVoice,
  onSelect,
}: {
  voices: TTSVoice<TTSVoiceId>[] | readonly TTSVoice<TTSVoiceId>[];
  icon: LucideIcon;
  title: string;
  description: string;
  selectedVoice: TTSVoiceId;
  onSelect: (voiceId: TTSVoiceId) => void;
}) => {
  return (
    <>
      {voices.map((voice) => (
        <button
          key={voice.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(voice.id);
          }}
          className={cn(
            "w-full p-2 rounded text-left text-sm transition-colors flex items-center gap-2",
            selectedVoice === voice.id ? "bg-primary/10" : "hover:bg-muted/50",
          )}
        >
          <span
            className={cn(
              "transition-colors w-12",
              selectedVoice === voice.id
                ? "text-gray-800"
                : "text-muted-foreground",
            )}
          >
            {voice.name.replace(/\s*\((Female|Male)\)/i, "")}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "text-sm w-4 text-center",
                    voice.gender === "female"
                      ? "text-pink-400"
                      : "text-blue-400",
                  )}
                >
                  {voice.gender === "female" ? "♀" : "♂"}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{voice.gender === "female" ? "Female" : "Male"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-4 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div
            className={cn(
              "h-2 w-2 rounded-full transition-all duration-200 flex-shrink-0 ml-auto",
              selectedVoice === voice.id ? "scale-100 bg-primary" : "scale-0",
            )}
          />
        </button>
      ))}
    </>
  );
};

const SettingToggleOption = ({ option }: { option: SettingOption }) => {
  return (
    <div
      key={option.id}
      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 justify-between"
      onClick={(e) => {
        e.stopPropagation();
        option.onToggle();
      }}
    >
      <div>
        <span
          className={cn(
            "select-none whitespace-nowrap text-sm transition-colors",
            option.enabled ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {option.label}
        </span>
        {option.description && (
          <span className="text-xs text-muted-foreground block">
            {option.description}
          </span>
        )}
      </div>
      <div
        className={cn(
          "h-2 w-2 rounded-full transition-all duration-200 flex-shrink-0",
          option.enabled
            ? "scale-100 bg-primary"
            : "scale-95 bg-muted-foreground/30",
        )}
      />
    </div>
  );
};

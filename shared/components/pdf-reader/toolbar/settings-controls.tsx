import { badgeVariants } from "../../ui/badge";
import { Button } from "../../ui/button";
import { ScrollArea } from "../../ui/scroll-area";
import { Switch } from "../../ui/switch";
import { usePdfSettingsStore } from "../../../lib/store";
import { getEngineFromVoice, type TTSVoiceId } from "../../../lib/tts";
import { BROWSER_VOICES } from "../../../lib/tts/providers/browser-provider";
import { KOKORO_VOICES } from "../../../lib/tts/providers/kokoro-provider";
import type { TTSVoice } from "../../../lib/tts/types";
import { cn } from "../../../lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, SettingsIcon } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useOnClickOutside } from "usehooks-ts";

type SettingsReader = "pdf" | "article";

interface SettingOption {
  id: string;
  label: string;
  beta?: boolean;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
}

const VOICE_GROUPS = [
  {
    voices: BROWSER_VOICES,
    title: "Browser",
    description: "Fast, lower quality",
  },
  {
    voices: KOKORO_VOICES,
    title: "Kokoro",
    description: "Better quality, slow first load",
  },
];

export const SettingsControls = ({
  reader = "pdf",
  open,
  onOpenChange,
}: {
  reader?: SettingsReader;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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
  const speakAlongEnabled = usePdfSettingsStore(
    (state) => state.speakAlongEnabled,
  );
  const setSpeakAlongEnabled = usePdfSettingsStore(
    (state) => state.setSpeakAlongEnabled,
  );

  useOnClickOutside(panelRef, (event) => {
    if (!open || triggerRef.current?.contains(event.target as Node)) return;
    onOpenChange(false);
  });

  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onOpenChangeRef.current(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const settingsOptions: SettingOption[] =
    reader === "article"
      ? []
      : [
          {
            id: "disable-links",
            label: "Disable PDF links",
            enabled: linksDisabled,
            onToggle: toggleLinksDisabled,
          },
          {
            id: "bionic-reading",
            label: "Bionic reading",
            beta: true,
            description: "If it overlaps, try zooming in",
            enabled: bionicReadingEnabled,
            onToggle: toggleBionicReading,
          },
          {
            id: "speed-read",
            label: "Speed read",
            description: "Word-by-word RSVP reader",
            enabled: rsvpOpen,
            onToggle: () => setRsvpOpen(!rsvpOpen),
          },
          {
            id: "speak-along",
            label: "Speak along",
            beta: true,
            description: "Practice pronunciation with your mic",
            enabled: speakAlongEnabled,
            onToggle: () => setSpeakAlongEnabled(!speakAlongEnabled),
          },
        ];

  const hasActiveSettings =
    settingsOptions.some((opt) => opt.enabled) ||
    getEngineFromVoice(voice) === "kokoro";

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="xs"
        className="block"
        aria-label="Reader settings"
        title="Reader settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <SettingsIcon
          aria-hidden="true"
          size={20}
          className={cn(hasActiveSettings && "text-foreground")}
        />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="absolute bottom-[calc(100%+0.75rem)] z-[99] cursor-default max-md:left-1/2 max-md:w-[calc(100vw-1rem)] max-md:max-w-sm max-md:-translate-x-1/2 md:right-0 md:w-72"
            ref={panelRef}
            role="dialog"
            aria-label="Reader settings"
            onClick={(e) => e.stopPropagation()}
          >
            <ScrollArea className="max-h-[min(32rem,62vh)] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg [&>[data-radix-scroll-area-viewport]]:max-h-[min(32rem,62vh)] [&>[data-radix-scroll-area-viewport]]:overscroll-none">
              <div className="p-1">
                {settingsOptions.length > 0 && (
                  <>
                    <Section title="Reading">
                      {settingsOptions.map((option) => (
                        <SettingToggleRow key={option.id} option={option} />
                      ))}
                    </Section>
                    <div className="-mx-1 my-1 h-px bg-border" />
                  </>
                )}
                <Section title="Voice">
                  <div
                    role="radiogroup"
                    aria-label="Voice"
                    onKeyDown={moveVoiceSelection}
                  >
                    {VOICE_GROUPS.map((group, groupIndex) => (
                      <VoiceGroup
                        firstRadioFocusable={
                          groupIndex === 0 && !hasKnownVoice(voice)
                        }
                        key={group.title}
                        title={group.title}
                        description={group.description}
                        voices={group.voices}
                        selectedVoice={voice}
                        onSelect={setVoice}
                      />
                    ))}
                  </div>
                </Section>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const hasKnownVoice = (voiceId: TTSVoiceId) =>
  VOICE_GROUPS.some((group) => group.voices.some((v) => v.id === voiceId));

const moveVoiceSelection = (event: ReactKeyboardEvent<HTMLDivElement>) => {
  const step =
    event.key === "ArrowDown" || event.key === "ArrowRight"
      ? 1
      : event.key === "ArrowUp" || event.key === "ArrowLeft"
      ? -1
      : 0;
  if (step === 0) return;
  event.preventDefault();
  const radios = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]',
    ),
  ];
  const current = radios.indexOf(document.activeElement as HTMLButtonElement);
  const next = radios[(current + step + radios.length) % radios.length];
  next?.focus();
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div>
    <h3 className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
      {title}
    </h3>
    {children}
  </div>
);

const SettingToggleRow = ({ option }: { option: SettingOption }) => {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm">
          {option.label}
          {option.beta && (
            <span
              className={cn(
                badgeVariants({ variant: "secondary" }),
                "px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide",
              )}
            >
              Beta
            </span>
          )}
        </span>
        {option.description && (
          <span className="block text-xs text-muted-foreground">
            {option.description}
          </span>
        )}
      </span>
      <Switch
        id={id}
        checked={option.enabled}
        onCheckedChange={option.onToggle}
      />
    </label>
  );
};

const VoiceGroup = ({
  title,
  description,
  voices,
  selectedVoice,
  onSelect,
  firstRadioFocusable,
}: {
  firstRadioFocusable: boolean;
  title: string;
  description: string;
  voices: readonly TTSVoice<TTSVoiceId>[];
  selectedVoice: TTSVoiceId;
  onSelect: (voiceId: TTSVoiceId) => void;
}) => {
  const labelId = useId();
  const inUse = voices.some((voice) => voice.id === selectedVoice);
  return (
    <div role="group" aria-labelledby={labelId} className="pb-1 pt-1">
      <div className="flex items-baseline gap-1.5 px-2 pb-1 pt-1.5 text-[11px] leading-4">
        <span
          id={labelId}
          className={cn(
            "font-semibold uppercase tracking-wider",
            inUse ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {title}
        </span>
        <span className="truncate text-muted-foreground">{description}</span>
        {inUse && (
          <span className="ml-auto shrink-0 font-medium text-primary">
            In use
          </span>
        )}
      </div>
      {voices.map((voice, index) => {
        const selected = selectedVoice === voice.id;
        return (
          <button
            key={voice.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (firstRadioFocusable && index === 0) ? 0 : -1}
            onClick={() => onSelect(voice.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          >
            <span>{voice.name.replace(/\s*\((Female|Male)\)/i, "")}</span>
            <span className="text-xs text-muted-foreground">
              {voice.gender === "female" ? "Female" : "Male"}
            </span>
            {selected && (
              <CheckIcon aria-hidden="true" className="ml-auto size-4" />
            )}
          </button>
        );
      })}
    </div>
  );
};

import { Button } from "@/components/ui/button";
import { usePdfSettingsStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Settings } from "lucide-react";
import { useRef, useState } from "react";
import { useOnClickOutside } from "usehooks-ts";

interface SettingOption {
  id: string;
  label: string;
  enabled: boolean;
  onToggle: () => void;
}

const SettingsIcon = ({ active }: { active: boolean }) => (
  <Button variant="ghost" size="xs" className="block">
    <Settings size={20} className={cn(active && "text-foreground")} />
  </Button>
);

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

  useOnClickOutside(containerRef, (e) => {
    // Don't close if clicking on the icon
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
    // also give user option to choose font -> mono/serif/sans
    {
      id: "bionic-reading",
      label: "Bionic reading (BETA)",
      enabled: bionicReadingEnabled,
      onToggle: toggleBionicReading,
    },
  ];

  const hasActiveSettings = settingsOptions.some((opt) => opt.enabled);

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
        <SettingsIcon active={hasActiveSettings} />
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
            className="absolute bottom-full mb-3 left-0 z-50"
            ref={containerRef}
          >
            <div className="rounded-lg border bg-background shadow-lg">
              {settingsOptions.map((option) => (
                <div
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 transition-colors hover:bg-muted/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    option.onToggle();
                  }}
                >
                  <span
                    className={cn(
                      "select-none whitespace-nowrap text-sm transition-colors",
                      option.enabled
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {option.label}
                  </span>
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full transition-all duration-200",
                      option.enabled
                        ? "scale-100 bg-primary"
                        : "scale-75 bg-muted-foreground/30",
                    )}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

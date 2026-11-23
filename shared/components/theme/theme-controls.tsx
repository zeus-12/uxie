import * as SelectPrimitive from "@radix-ui/react-select";
import {
  Check,
  ChevronDown,
  Monitor,
  Moon,
  Palette,
  Sun,
  type LucideIcon,
} from "lucide-react";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import {
  APPEARANCE_THEMES,
  isPresetTheme,
  isTheme,
  PRESET_THEMES,
  type AppearanceTheme,
  type PresetTheme,
  type Theme,
} from "../../lib/theme";
import { cn } from "../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Select, SelectContent, SelectTrigger } from "../ui/select";
import { useTheme } from "./theme-provider";

const APPEARANCE_OPTIONS = {
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
  system: { label: "System", icon: Monitor },
} satisfies Record<AppearanceTheme, { label: string; icon: LucideIcon }>;

const PRESET_LABELS = {
  "tokyo-night": "Tokyo Night",
  "catppuccin-mocha": "Catppuccin Mocha",
  "rose-pine": "Rosé Pine",
  "kanagawa-wave": "Kanagawa Wave",
  "ayu-mirage": "Ayu Mirage",
  everforest: "Everforest",
  "solarized-dark": "Solarized Dark",
} satisfies Record<PresetTheme, string>;

export function ThemeSwatch({
  theme,
  className,
}: {
  theme: PresetTheme;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-theme={theme}
      className={cn(
        "inline-flex h-5 w-10 shrink-0 items-center justify-center gap-1 rounded-[5px] bg-background ring-1 ring-inset ring-foreground/20",
        className,
      )}
    >
      <span className="size-2 rounded-full bg-primary" />
      <span className="size-2 rounded-full bg-[hsl(var(--palette-red))]" />
      <span className="size-2 rounded-full bg-[hsl(var(--palette-yellow))]" />
    </span>
  );
}

function ModeRadioItems() {
  const { setTheme } = useTheme();
  return (
    <>
      {APPEARANCE_THEMES.map((option) => {
        const { icon: Icon, label } = APPEARANCE_OPTIONS[option];
        return (
          <DropdownMenuRadioItem
            key={option}
            value={option}
            className="gap-2"
            onSelect={() => setTheme(option)}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </DropdownMenuRadioItem>
        );
      })}
    </>
  );
}

function PresetRadioItems() {
  const { setTheme } = useTheme();
  return (
    <>
      {PRESET_THEMES.map((option) => (
        <DropdownMenuRadioItem
          key={option}
          value={option}
          className="gap-2.5"
          onSelect={() => setTheme(option)}
        >
          <ThemeSwatch theme={option} />
          {PRESET_LABELS[option]}
        </DropdownMenuRadioItem>
      ))}
    </>
  );
}

function ThemeRadioItems() {
  const { theme } = useTheme();
  return (
    <DropdownMenuRadioGroup value={theme}>
      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
        Mode
      </DropdownMenuLabel>
      <ModeRadioItems />
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
        Presets
      </DropdownMenuLabel>
      <PresetRadioItems />
    </DropdownMenuRadioGroup>
  );
}

export function ThemeMenuSub() {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <Palette aria-hidden="true" className="size-4" />
        Appearance
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        <ThemeRadioItems />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function ThemeMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <ThemeRadioItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const ThemeButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button">
>(({ className, ...props }, ref) => {
  const { resolvedTheme, theme } = useTheme();
  const Icon = isPresetTheme(theme)
    ? Palette
    : resolvedTheme === "dark"
    ? Moon
    : Sun;

  return (
    <button
      ref={ref}
      type="button"
      aria-label="Change appearance"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
});
ThemeButton.displayName = "ThemeButton";

function ModePicker({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Mode"
      className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
    >
      {APPEARANCE_THEMES.map((option) => {
        const { icon: Icon, label } = APPEARANCE_OPTIONS[option];
        const selected = theme === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => setTheme(option)}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected &&
                "bg-background text-foreground shadow-sm ring-1 ring-border",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function PresetSelect({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}) {
  const preset = isPresetTheme(theme) ? theme : undefined;

  return (
    <Select
      value={preset ?? ""}
      onValueChange={(value) => {
        if (isTheme(value) && isPresetTheme(value)) setTheme(value);
      }}
    >
      <SelectTrigger
        aria-label="Preset"
        className="h-10 gap-2.5 px-3 data-[placeholder]:text-muted-foreground [&>span]:flex [&>span]:items-center [&>span]:gap-2.5"
      >
        <SelectPrimitive.Value placeholder="None">
          {preset && (
            <>
              <ThemeSwatch theme={preset} />
              {PRESET_LABELS[preset]}
            </>
          )}
        </SelectPrimitive.Value>
        <ChevronDown
          aria-hidden="true"
          className="ml-auto size-4 text-muted-foreground"
        />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {PRESET_THEMES.map((option) => (
          <SelectPrimitive.Item
            key={option}
            value={option}
            className="relative flex cursor-default select-none items-center gap-2.5 rounded-sm py-2 pl-2 pr-8 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
          >
            <ThemeSwatch theme={option} />
            <SelectPrimitive.ItemText>
              {PRESET_LABELS[option]}
            </SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
              <Check aria-hidden="true" className="size-4" />
            </SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Mode</span>
        <ModePicker theme={theme} setTheme={setTheme} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Preset</span>
        <PresetSelect theme={theme} setTheme={setTheme} />
        <span className="text-xs text-muted-foreground">
          A preset replaces the mode with its own dark palette.
        </span>
      </div>
    </div>
  );
}

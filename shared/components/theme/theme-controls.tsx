import { Monitor, Moon, Palette, Sun, type LucideIcon } from "lucide-react";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  APPEARANCE_THEMES,
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
import { useTheme } from "./theme-provider";

const APPEARANCE_OPTIONS = {
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
  system: { label: "System", icon: Monitor },
} satisfies Record<AppearanceTheme, { label: string; icon: LucideIcon }>;

const PRESET_OPTIONS = {
  "tokyo-night": {
    label: "Tokyo Night",
    colors: ["#1a1b26", "#7aa2f7"],
  },
  "catppuccin-mocha": {
    label: "Catppuccin Mocha",
    colors: ["#1e1e2e", "#cba6f7"],
  },
  "rose-pine": {
    label: "Rosé Pine",
    colors: ["#191724", "#c4a7e7"],
  },
  "kanagawa-wave": {
    label: "Kanagawa Wave",
    colors: ["#1f1f28", "#7e9cd8"],
  },
  "ayu-mirage": {
    label: "Ayu Mirage",
    colors: ["#1f2430", "#ffcc66"],
  },
  everforest: {
    label: "Everforest",
    colors: ["#2d353b", "#7fbbb3"],
  },
  "solarized-dark": {
    label: "Solarized Dark",
    colors: ["#002b36", "#2aa198"],
  },
} satisfies Record<PresetTheme, { label: string; colors: [string, string] }>;

function isPresetTheme(theme: Theme): theme is PresetTheme {
  return theme !== "light" && theme !== "dark" && theme !== "system";
}

function PresetSwatch({ theme }: { theme: PresetTheme }) {
  const [background, accent] = PRESET_OPTIONS[theme].colors;
  const style = {
    background: `linear-gradient(135deg, ${background} 0 50%, ${accent} 50%)`,
  } satisfies CSSProperties;

  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 rounded-full border border-white/20 shadow-sm"
      style={style}
    />
  );
}

function ThemeRadioItems() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenuRadioGroup value={theme}>
      <DropdownMenuLabel className="text-xs text-muted-foreground">
        Appearance
      </DropdownMenuLabel>
      {APPEARANCE_THEMES.map((option) => {
        const { icon: Icon, label } = APPEARANCE_OPTIONS[option];
        return (
          <DropdownMenuRadioItem
            key={option}
            value={option}
            className="gap-2"
            onSelect={() => setTheme(option)}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </DropdownMenuRadioItem>
        );
      })}
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs text-muted-foreground">
        Presets
      </DropdownMenuLabel>
      {PRESET_THEMES.map((option) => (
        <DropdownMenuRadioItem
          key={option}
          value={option}
          className="gap-2"
          onSelect={() => setTheme(option)}
        >
          <PresetSwatch theme={option} />
          {PRESET_OPTIONS[option].label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

export function ThemeMenuSub() {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <Palette aria-hidden="true" className="h-4 w-4" />
        Appearance
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        <ThemeRadioItems />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function ThemeMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
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
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
});
ThemeButton.displayName = "ThemeButton";

function AppearancePicker({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}) {
  return (
    <div className="grid grid-cols-3 rounded-lg bg-muted p-1">
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
              "relative inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected && "bg-background text-foreground shadow-sm",
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-2" aria-label="Appearance">
      <AppearancePicker theme={theme} setTheme={setTheme} />
      <span className="text-xs font-medium text-muted-foreground">Presets</span>
      <div className="grid grid-cols-2 gap-1">
        {PRESET_THEMES.map((option) => {
          const selected = theme === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setTheme(option)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected &&
                  "border-primary bg-accent text-foreground shadow-sm",
              )}
            >
              <PresetSwatch theme={option} />
              <span className="truncate">{PRESET_OPTIONS[option].label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

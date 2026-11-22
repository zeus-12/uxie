import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  parseTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
} from "../../lib/theme";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  }
  return theme === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", resolved === "dark");
  return resolved;
}

// Without this every `transition-colors` element animates separately and the
// switch smears across the screen instead of landing in one frame.
function withoutTransitions(change: () => void) {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  change();
  void getComputedStyle(document.body).transition;
  requestAnimationFrame(() => style.remove());
}

function readStoredTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function storeTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const themeRef = useRef<Theme>("system");

  const show = useCallback((next: Theme) => {
    themeRef.current = next;
    setThemeState(next);
    withoutTransitions(() => setResolvedTheme(applyTheme(next)));
  }, []);

  useBrowserLayoutEffect(() => {
    show(readStoredTheme());

    const media = window.matchMedia(DARK_QUERY);
    const handleSystemChange = () => {
      if (themeRef.current === "system") show("system");
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) show(parseTheme(event.newValue));
    };
    media.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      media.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [show]);

  const setTheme = useCallback(
    (next: Theme) => {
      storeTheme(next);
      show(next);
    },
    [show],
  );

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [resolvedTheme, setTheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return value;
}

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
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

const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "light") return "light";
  if (theme !== "system") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme): ResolvedTheme {
  const resolvedTheme = resolveTheme(theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.style.colorScheme = resolvedTheme;
  return resolvedTheme;
}

function readStoredTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts. The
    // in-memory preference still applies for the current session.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [mounted, setMounted] = useState(false);

  useBrowserLayoutEffect(() => {
    const storedTheme = readStoredTheme();
    setTheme(storedTheme);
    setResolvedTheme(applyTheme(storedTheme));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    storeTheme(theme);
    setResolvedTheme(applyTheme(theme));

    if (theme !== "system") return;

    const colourScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setResolvedTheme(applyTheme("system"));
    colourScheme.addEventListener("change", handleChange);
    return () => colourScheme.removeEventListener("change", handleChange);
  }, [mounted, theme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [resolvedTheme, theme],
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

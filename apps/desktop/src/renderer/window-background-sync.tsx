import { useEffect } from "react";
import { useTheme } from "@uxie/shared/components/theme/theme-provider";
import type { ResolvedTheme } from "@uxie/shared/lib/theme";

function backgroundOf(theme: ResolvedTheme): string {
  const probe = document.createElement("div");
  probe.dataset.theme = theme;
  probe.style.background = "hsl(var(--background))";
  probe.hidden = true;
  document.body.appendChild(probe);
  const colour = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return colour;
}

export function WindowBackgroundSync() {
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    if (theme === "system") {
      window.uxieAPI.setWindowBackground({
        light: backgroundOf("light"),
        dark: backgroundOf("dark"),
      });
      return;
    }
    const current = getComputedStyle(document.body).backgroundColor;
    window.uxieAPI.setWindowBackground({ light: current, dark: current });
  }, [theme, resolvedTheme]);

  return null;
}

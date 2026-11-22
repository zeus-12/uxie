import { useEffect } from "react";
import { useTheme } from "@uxie/shared/components/theme/theme-provider";

export function WindowBackgroundSync() {
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    window.uxieAPI.setWindowBackground(
      getComputedStyle(document.body).backgroundColor,
    );
  }, [theme, resolvedTheme]);

  return null;
}

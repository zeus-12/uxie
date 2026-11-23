import type { CSSProperties, ReactNode } from "react";
import { usePdfSettingsStore } from "../../lib/store";
import { useTheme } from "../theme/theme-provider";

export type PageTone = "ink" | "paper";

export function usePageTone(): PageTone {
  const { resolvedTheme } = useTheme();
  const pageColour = usePdfSettingsStore((s) => s.pageColour);
  return resolvedTheme === "dark" && pageColour === "theme" ? "ink" : "paper";
}

export function PdfPageTone({ children }: { children: ReactNode }) {
  const tone = usePageTone();
  const pageColour = usePdfSettingsStore((s) => s.pageColour);

  return (
    <div
      className="uxie-pdf-page"
      data-page-tone={tone}
      style={
        {
          "--page-tint":
            pageColour === "theme" ? "hsl(var(--background))" : pageColour,
        } as CSSProperties
      }
    >
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <filter id="uxie-ink-page" colorInterpolationFilters="sRGB">
          <feComponentTransfer in="SourceGraphic" result="weighted">
            <feFuncR type="gamma" exponent="0.55" />
            <feFuncG type="gamma" exponent="0.55" />
            <feFuncB type="gamma" exponent="0.55" />
          </feComponentTransfer>
          <feFlood
            style={{ floodColor: "hsl(var(--foreground))" }}
            result="ink"
          />
          <feBlend in="weighted" in2="ink" mode="multiply" result="inked" />
          <feFlood
            style={{ floodColor: "hsl(var(--background))" }}
            result="paper"
          />
          <feBlend in="inked" in2="paper" mode="lighten" result="toned" />
          <feComposite in="toned" in2="SourceAlpha" operator="in" />
        </filter>
      </svg>
      {children}
    </div>
  );
}

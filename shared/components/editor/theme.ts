import {
  darkDefaultTheme,
  lightDefaultTheme,
  type Theme as BlockNoteTheme,
} from "@blocknote/mantine";
import { type ResolvedTheme } from "../../lib/theme";

const surfaceColors = {
  editor: {
    text: "hsl(var(--foreground))",
    background: "transparent",
  },
  menu: {
    text: "hsl(var(--popover-foreground))",
    background: "hsl(var(--popover))",
  },
  tooltip: {
    text: "hsl(var(--popover-foreground))",
    background: "hsl(var(--secondary))",
  },
  hovered: {
    text: "hsl(var(--accent-foreground))",
    background: "hsl(var(--accent))",
  },
  selected: {
    text: "hsl(var(--primary-foreground))",
    background: "hsl(var(--primary))",
  },
  disabled: {
    text: "hsl(var(--muted-foreground))",
    background: "hsl(var(--muted))",
  },
  shadow: "hsl(var(--foreground) / 0.18)",
  border: "hsl(var(--border))",
  sideMenu: "hsl(var(--muted-foreground))",
} satisfies NonNullable<BlockNoteTheme["colors"]>;

const darkHighlights = {
  gray: { text: "hsl(240 4.9% 83.9%)", background: "hsl(240 3.7% 15.9%)" },
  brown: {
    text: "hsl(30.7 97.2% 72.4%)",
    background: "hsl(26 83.3% 14.1%)",
  },
  red: { text: "hsl(0 93.5% 81.8%)", background: "hsl(0 74.7% 15.5%)" },
  orange: {
    text: "hsl(30.7 97.2% 72.4%)",
    background: "hsl(13 81.1% 14.5%)",
  },
  yellow: {
    text: "hsl(48 96.6% 76.7%)",
    background: "hsl(26 83.3% 14.1%)",
  },
  green: {
    text: "hsl(141.7 76.6% 73.1%)",
    background: "hsl(144.9 80.4% 10%)",
  },
  blue: {
    text: "hsl(211.7 96.4% 78.4%)",
    background: "hsl(226.2 57% 21%)",
  },
  purple: {
    text: "hsl(269.2 97.4% 85.1%)",
    background: "hsl(273.5 86.9% 21%)",
  },
  pink: {
    text: "hsl(327.4 87.1% 81.8%)",
    background: "hsl(336.2 83.9% 17.1%)",
  },
} satisfies NonNullable<NonNullable<BlockNoteTheme["colors"]>["highlights"]>;

const blockNoteThemes = {
  light: {
    ...lightDefaultTheme,
    colors: {
      ...lightDefaultTheme.colors,
      ...surfaceColors,
    },
  },
  dark: {
    ...darkDefaultTheme,
    colors: {
      ...darkDefaultTheme.colors,
      ...surfaceColors,
      highlights: darkHighlights,
    },
  },
} satisfies Record<ResolvedTheme, BlockNoteTheme>;

export function getBlockNoteTheme(theme: ResolvedTheme): BlockNoteTheme {
  return blockNoteThemes[theme];
}

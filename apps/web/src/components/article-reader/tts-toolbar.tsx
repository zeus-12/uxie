import { SidebarDrawerTrigger } from "@/components/workspace/sidebar-drawer";
import { READING_STATUS } from "@uxie/shared/components/pdf-reader/constants";
import {
  BackgroundControlsContent,
  BackgroundControlsIcon,
} from "@uxie/shared/components/pdf-reader/toolbar/background-controls";
import { PanelToggle } from "@uxie/shared/components/pdf-reader/toolbar/panel-toggle";
import { SettingsControls } from "@uxie/shared/components/pdf-reader/toolbar/settings-controls";
import {
  TTSControlsContent,
  TTSControlsIcon,
} from "@uxie/shared/components/pdf-reader/toolbar/tts-controls";
import { Button } from "@uxie/shared/components/ui/button";
import {
  ExpandableTabs,
  type Tab,
} from "@uxie/shared/components/ui/expandable-tabs";
import { READER_BACKGROUND_COLOURS } from "@uxie/shared/lib/constants";
import {
  type ArticleFontFamily,
  useArticleSettingsStore,
} from "@uxie/shared/lib/store";
import { cn } from "@uxie/shared/lib/utils";
import { ALargeSmallIcon, ExternalLinkIcon } from "lucide-react";
import { useMemo } from "react";
import { useMediaQuery } from "usehooks-ts";

const ARTICLE_FONT_SIZES = [16, 18, 20, 22] as const;
const ARTICLE_FONTS = [
  { id: "sans", label: "Sans", className: "font-sans" },
  { id: "serif", label: "Serif", className: "font-serif" },
  { id: "mono", label: "Mono", className: "font-mono" },
] satisfies ReadonlyArray<{
  id: ArticleFontFamily;
  label: string;
  className: string;
}>;
type ArticleTts = {
  readingStatus: READING_STATUS;
  currentReadingSpeed: number;
  followAlongEnabled: boolean;
  startReading: (continueReading?: boolean) => Promise<void>;
  pauseReading: () => void;
  resumeReading: () => void;
  stopReading: () => void;
  skipSentence: () => void;
  skipToPreviousSentence: () => void;
  handleReadingSpeedChange: () => Promise<void>;
  toggleFollowAlong: () => void;
};

function TextAppearanceControls() {
  const fontFamily = useArticleSettingsStore((state) => state.fontFamily);
  const setFontFamily = useArticleSettingsStore((state) => state.setFontFamily);
  const fontSize = useArticleSettingsStore((state) => state.fontSize);
  const setFontSize = useArticleSettingsStore((state) => state.setFontSize);
  const sizeIndex = ARTICLE_FONT_SIZES.indexOf(fontSize);

  const changeSize = (direction: -1 | 1) => {
    const nextSize = ARTICLE_FONT_SIZES[sizeIndex + direction];
    if (nextSize !== undefined) setFontSize(nextSize);
  };

  return (
    <div className="flex items-center gap-1 pr-1">
      <div className="flex items-center rounded-md bg-muted/70 p-0.5">
        {ARTICLE_FONTS.map((font) => (
          <Button
            key={font.id}
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "h-7 px-2 text-xs",
              font.className,
              fontFamily === font.id && "bg-background shadow-sm",
            )}
            onClick={() => setFontFamily(font.id)}
            aria-pressed={fontFamily === font.id}
          >
            {font.label}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="w-7 px-0 text-base"
        disabled={sizeIndex === 0}
        onClick={() => changeSize(-1)}
        aria-label="Decrease text size"
      >
        −
      </Button>
      <span className="w-5 text-center text-xs tabular-nums" aria-live="polite">
        {fontSize}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="w-7 px-0 text-base"
        disabled={sizeIndex === ARTICLE_FONT_SIZES.length - 1}
        onClick={() => changeSize(1)}
        aria-label="Increase text size"
      >
        +
      </Button>
    </div>
  );
}

function TextAppearanceIcon() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      aria-label="Text appearance"
      title="Text appearance"
    >
      <ALargeSmallIcon aria-hidden="true" className="h-5 w-5" />
    </Button>
  );
}

function OriginalArticleLink({ url }: { url: string }) {
  return (
    <Button asChild variant="ghost" size="xs">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open original article"
        title="Open original article"
      >
        <ExternalLinkIcon aria-hidden="true" className="h-5 w-5" />
      </a>
    </Button>
  );
}

export function ArticleBottomToolbar({
  tts,
  originalUrl,
}: {
  tts: ArticleTts;
  originalUrl: string;
}) {
  const backgroundColour = useArticleSettingsStore(
    (state) => state.backgroundColour,
  );
  const setBackgroundColour = useArticleSettingsStore(
    (state) => state.setBackgroundColour,
  );
  const isSmallScreen = useMediaQuery("(max-width: 767px)");

  const tabs: Tab[] = useMemo(
    () => [
      {
        children: <TextAppearanceControls />,
        icon: <TextAppearanceIcon />,
        clickOutsideToClose: true,
      },
      {
        children: (
          <TTSControlsContent
            readingStatus={tts.readingStatus}
            startWordByWordHighlighting={tts.startReading}
            pauseReading={tts.pauseReading}
            resumeReading={tts.resumeReading}
            stopReading={tts.stopReading}
            skipSentence={tts.skipSentence}
            skipToPreviousSentence={tts.skipToPreviousSentence}
            handleReadingSpeedChange={tts.handleReadingSpeedChange}
            currentReadingSpeed={tts.currentReadingSpeed}
            followAlongEnabled={tts.followAlongEnabled}
            toggleFollowAlong={tts.toggleFollowAlong}
          />
        ),
        icon: <TTSControlsIcon />,
        clickOutsideToClose: tts.readingStatus === READING_STATUS.IDLE,
      },
      {
        children: (
          <BackgroundControlsContent
            pageColour={backgroundColour}
            pageColourChangeHandler={(colour) => {
              const nextColour = READER_BACKGROUND_COLOURS.find(
                (candidate) => candidate === colour,
              );
              if (nextColour) setBackgroundColour(nextColour);
            }}
          />
        ),
        icon: <BackgroundControlsIcon pageColour={backgroundColour} />,
        clickOutsideToClose: true,
        closeOnChildClick: true,
      },
      {
        children: null,
        icon: <SettingsControls reader="article" />,
        clickOutsideToClose: false,
      },
      {
        children: null,
        icon: <OriginalArticleLink url={originalUrl} />,
        clickOutsideToClose: false,
      },
      {
        children: null,
        icon: isSmallScreen ? <SidebarDrawerTrigger /> : <PanelToggle />,
        clickOutsideToClose: false,
      },
    ],
    [backgroundColour, isSmallScreen, originalUrl, setBackgroundColour, tts],
  );

  return (
    <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 flex-col items-center">
      <ExpandableTabs tabs={tabs} />
    </div>
  );
}

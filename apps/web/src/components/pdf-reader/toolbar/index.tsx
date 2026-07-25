import { READING_STATUS } from "@/components/pdf-reader/constants";
import { RsvpReader } from "@uxie/shared/components/pdf-reader/rsvp-reader";
import { SpeakAlong } from "@/components/pdf-reader/speak-along";
import { ExpandableTabs, type Tab } from "@uxie/shared/components/ui/expandable-tabs";
import SidebarDrawer from "@/components/workspace/sidebar-drawer";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useMediaQuery } from "usehooks-ts";
import {
  BackgroundControlsContent,
  BackgroundControlsIcon,
} from "@uxie/shared/components/pdf-reader/toolbar/background-controls";
import { PageControlsContent, PageControlsIcon } from "@uxie/shared/components/pdf-reader/toolbar/page-controls";
import { PanelToggle } from "@uxie/shared/components/pdf-reader/toolbar/panel-toggle";
import { SettingsControls } from "@uxie/shared/components/pdf-reader/toolbar/settings-controls";
import { TTSControlsContent, TTSControlsIcon } from "@uxie/shared/components/pdf-reader/toolbar/tts-controls";
import { ZoomControlsContent, ZoomControlsIcon } from "@uxie/shared/components/pdf-reader/toolbar/zoom-controls";

const BottomToolbar = ({
  pageNumberInView,
  currentReadingSpeed,
  readingStatus,
  startWordByWordHighlighting,
  handleReadingSpeedChange,
  resumeReading,
  stopReading,
  pauseReading,
  skipSentence,
  totalPages,
  onZoomChange,
  onPageChange,
  currentZoom,
  pageColour,
  pageColourChangeHandler,
  followAlongEnabled,
  toggleFollowAlong,
}: {
  pageNumberInView: number;
  currentReadingSpeed: number;
  readingStatus: READING_STATUS;
  handleReadingSpeedChange: () => Promise<void>;
  resumeReading: () => void;
  stopReading: () => void;
  pauseReading: () => void;
  skipSentence: () => void;
  startWordByWordHighlighting: (isContinueReading: boolean) => Promise<void>;
  totalPages: number;
  onZoomChange: (zoom: number) => void;
  onPageChange: (page: number) => void;
  currentZoom: number;
  pageColour: string;
  pageColourChangeHandler: (colour: string) => void;
  followAlongEnabled: boolean;
  toggleFollowAlong: () => void;
}) => {
  const [pageNumber, setPageNumber] = useState(1);

  // update if tailwind config is changed
  const isSmallScreen = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    setPageNumber(pageNumberInView);
  }, [pageNumberInView]);

  const debouncedHandlePageChange = useDebouncedCallback(
    (page: number) => onPageChange(page),
    500,
  );

  const tabs: Tab[] = useMemo(() => {
    return [
      {
        children: (
          <PageControlsContent
            debouncedHandlePageChange={debouncedHandlePageChange}
            pageNumber={pageNumber}
            setPageNumber={setPageNumber}
            totalPages={totalPages}
          />
        ),
        icon: (
          <PageControlsIcon
            pageNumberInView={pageNumberInView}
            totalPages={totalPages}
          />
        ),
        clickOutsideToClose: true,
      },
      {
        children: (
          <ZoomControlsContent
            currentZoom={currentZoom}
            onZoomChange={onZoomChange}
          />
        ),
        icon: <ZoomControlsIcon />,
        clickOutsideToClose: true,
      },
      {
        children: (
          <TTSControlsContent
            currentReadingSpeed={currentReadingSpeed}
            readingStatus={readingStatus}
            startWordByWordHighlighting={startWordByWordHighlighting}
            handleReadingSpeedChange={handleReadingSpeedChange}
            resumeReading={resumeReading}
            stopReading={stopReading}
            pauseReading={pauseReading}
            skipSentence={skipSentence}
            followAlongEnabled={followAlongEnabled}
            toggleFollowAlong={toggleFollowAlong}
          />
        ),
        icon: <TTSControlsIcon />,
        clickOutsideToClose: readingStatus === READING_STATUS.IDLE,
      },
      {
        children: (
          <BackgroundControlsContent
            pageColour={pageColour}
            pageColourChangeHandler={pageColourChangeHandler}
          />
        ),
        icon: <BackgroundControlsIcon pageColour={pageColour} />,
        clickOutsideToClose: true,
      },
      {
        children: null,
        icon: <SettingsControls />,
        clickOutsideToClose: false,
      },
      ...(!isSmallScreen
        ? [
            {
              children: null,
              icon: <PanelToggle />,
              clickOutsideToClose: false,
            },
          ]
        : []),
      ...(isSmallScreen
        ? [
            {
              children: null,
              icon: (
                <div className="md:hidden">
                  <SidebarDrawer />
                </div>
              ),
              clickOutsideToClose: false,
            },
          ]
        : []),
    ];
  }, [
    isSmallScreen,
    pageNumber,
    pageNumberInView,
    currentZoom,
    currentReadingSpeed,
    readingStatus,
    pageColour,
    followAlongEnabled,
    debouncedHandlePageChange,
    totalPages,
    onZoomChange,
    startWordByWordHighlighting,
    handleReadingSpeedChange,
    resumeReading,
    stopReading,
    pauseReading,
    skipSentence,
    toggleFollowAlong,
    pageColourChangeHandler,
  ]);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
      <SpeakAlong pageNumber={pageNumberInView} pageCount={totalPages} />
      <RsvpReader pageNumber={pageNumberInView} pageCount={totalPages} />
      <ExpandableTabs tabs={tabs} />
    </div>
  );
};

export default BottomToolbar;

import { READING_STATUS } from "@/components/pdf-reader/constants";
import { ExpandableTabs, Tab } from "@/components/ui/expandable-tabs";
import SidebarDrawer from "@/components/workspace/sidebar-drawer";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useMediaQuery } from "usehooks-ts";
import {
  BackgroundControlsContent,
  BackgroundControlsIcon,
} from "./background-controls";
import { PageControlsContent, PageControlsIcon } from "./page-controls";
import { TTSControlsContent, TTSControlsIcon } from "./tts-controls";
import { ZoomControlsContent, ZoomControlsIcon } from "./zoom-controls";

const BottomToolbar = ({
  pageNumberInView,
  currentReadingSpeed,
  readingStatus,
  startWordByWordHighlighting,
  handleReadingSpeedChange,
  resumeReading,
  stopReading,
  pauseReading,
  canEdit,
  isOwner,
  isVectorised,
  note,
  totalPages,
  onZoomChange,
  onPageChange,
  currentZoom,
  pageColour,
  pageColourChangeHandler,
}: {
  pageNumberInView: number;
  currentReadingSpeed: number;
  readingStatus: READING_STATUS;
  handleReadingSpeedChange: () => Promise<void>;
  resumeReading: () => void;
  stopReading: () => void;
  pauseReading: () => void;
  startWordByWordHighlighting: (isContinueReading: boolean) => Promise<void>;
  canEdit: boolean;
  isOwner: boolean;
  isVectorised: boolean;
  note: string | null;
  totalPages: number;
  onZoomChange: (zoom: number) => void;
  onPageChange: (page: number) => void;
  currentZoom: number;
  pageColour: string;
  pageColourChangeHandler: (colour: string) => void;
}) => {
  const [pageNumber, setPageNumber] = useState(1);

  // for the mobile-view drawer
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
          />
        ),
        icon: <TTSControlsIcon />,
        clickOutsideToClose: false,
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
      ...(isSmallScreen
        ? [
            {
              children: <></>,
              icon: (
                <div className="md:hidden">
                  <SidebarDrawer
                    isOwner={isOwner}
                    isVectorised={isVectorised}
                    canEdit={canEdit}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                    note={note}
                  />
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
    currentZoom,
    currentReadingSpeed,
    readingStatus,
    pageColour,
    isSidebarOpen,
  ]);

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <ExpandableTabs tabs={tabs} />
    </div>
  );
};

export default BottomToolbar;

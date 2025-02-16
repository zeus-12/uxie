import { READING_STATUS } from "@/components/pdf-reader/constants";
import { Button } from "@/components/ui/button";
import { ExpandableTabs, Tab } from "@/components/ui/expandable-tabs";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { PDF_BACKGROUND_COLOURS } from "@/lib/constants";
import {
  AudioLinesIcon,
  BanIcon,
  PauseIcon,
  PlayIcon,
  ZoomInIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useMediaQuery } from "usehooks-ts";
import SidebarDrawer from "../workspace/sidebar-drawer";

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
  const browserSupportsSpeechSynthesis = "speechSynthesis" in window;
  const [pageNumber, setPageNumber] = useState(1);

  // for the mobile-view drawer
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // update if tailwind config is changed
  const isMobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    setPageNumber(pageNumberInView);
  }, [pageNumberInView]);

  const debouncedHandlePageChange = useDebouncedCallback(
    (page: number) => onPageChange(page),
    500,
  );

  const tabs: Tab[] = [
    {
      children: (
        <Input
          className="h-7"
          value={pageNumber > 0 ? pageNumber : ""}
          onChange={(e) => {
            const value = e.target.value;
            const pageNum = Number(value);
            setPageNumber(pageNum);
            if (pageNum > 0 && pageNum <= totalPages) {
              debouncedHandlePageChange(pageNum);
            }
          }}
          type="number"
          min={1}
          max={totalPages}
          placeholder="Go to page..."
        />
      ),
      icon: (
        <Button className="" variant="ghost" size="xs">
          {pageNumberInView > 0 ? (
            <p className="">
              {pageNumberInView}{" "}
              <span className="text-muted-foreground px-[2px]">/</span>{" "}
              <span className="text-muted-foreground">{totalPages}</span>
            </p>
          ) : (
            <div className="h-7 w-7 bg-gray-200 animate-pulse m-auto rounded-md" />
          )}
        </Button>
      ),
      clickOutsideToClose: true,
    },
    {
      children: (
        <div className="gap-2 flex">
          <p className="text-sm font-medium">
            {Math.round(currentZoom * 100)}%
          </p>

          <Slider
            defaultValue={[100]}
            value={[currentZoom * 100]}
            onValueChange={(value) =>
              onZoomChange((value?.[0] ?? currentZoom * 100) / 100)
            }
            min={50}
            max={200}
            step={10}
            className="[&>:last-child>span]:h-6 [&>:last-child>span]:w-2 [&>:last-child>span]:border-[1px] [&>:last-child>span]:border-background [&>:last-child>span]:bg-primary [&>:last-child>span]:ring-offset-0 w-24"
          />
        </div>
      ),
      icon: (
        <Button variant="ghost" size="xs" className="block">
          <ZoomInIcon className="h-5 w-5" />
        </Button>
      ),
      clickOutsideToClose: true,
    },
    {
      children: (
        <div className="relative w-full">
          <div className="gap-1 relative z-50 flex items-center rounded-lg">
            {readingStatus === READING_STATUS.IDLE && (
              <div>
                <Button
                  onClick={() => startWordByWordHighlighting(false)}
                  variant="ghost"
                  size="xs"
                >
                  <PlayIcon className="h-5 w-5" />
                </Button>
              </div>
            )}
            {readingStatus === READING_STATUS.READING && (
              <div>
                <Button onClick={pauseReading} variant="ghost" size="xs">
                  <PauseIcon className="h-5 w-5" />
                </Button>
              </div>
            )}

            {readingStatus === READING_STATUS.PAUSED && (
              <div>
                <Button onClick={resumeReading} variant="ghost" size="xs">
                  <PlayIcon className="h-5 w-5" />
                </Button>
              </div>
            )}
            <div>
              <Button
                onClick={stopReading}
                disabled={readingStatus === READING_STATUS.IDLE}
                variant="ghost"
                size="xs"
              >
                <BanIcon className="h-5 w-5" />
              </Button>
            </div>
            <div>
              <Button
                onClick={handleReadingSpeedChange}
                variant="ghost"
                size="xs"
              >
                {currentReadingSpeed}x
              </Button>
            </div>
          </div>
        </div>
      ),
      icon: (
        <Button
          variant="ghost"
          size="xs"
          disabled={!browserSupportsSpeechSynthesis}
        >
          <AudioLinesIcon className="h-5 w-5" />
        </Button>
      ),
      clickOutsideToClose: false,
    },
    {
      children: (
        <div className="flex gap-2 cursor-pointer">
          {PDF_BACKGROUND_COLOURS.filter((colour) => colour !== pageColour).map(
            (colour) => (
              <div
                onClick={() => pageColourChangeHandler(colour)}
                key={colour}
                className="w-6 h-6 rounded-md"
                style={{ backgroundColor: colour }}
              />
            ),
          )}
        </div>
      ),
      icon: (
        <div
          className="w-6 h-6 rounded-md cursor-pointer"
          style={{
            backgroundColor:
              pageColour === PDF_BACKGROUND_COLOURS[0] ? "#F3F4F6" : pageColour,
          }}
        />
      ),
      clickOutsideToClose: true,
    },
    ...(isMobile
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

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <ExpandableTabs tabs={tabs} />
    </div>
  );
};

export default BottomToolbar;

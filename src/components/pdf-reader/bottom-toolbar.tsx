import { READING_STATUS } from "@/components/pdf-reader/constants";
import { Button } from "@/components/ui/button";
import SidebarDrawer from "@/components/workspace/sidebar-drawer";
import { MotionConfig } from "framer-motion";
import {
  ArrowLeftIcon,
  AudioLinesIcon,
  BanIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";
import { useRef, useState } from "react";

const transition = {
  type: "spring",
  bounce: 0.1,
  duration: 0.2,
};

const BottomToolbar = ({
  pageNumberInView,
  currentReadingSpeed,
  readingStatus,
  startWordByWordHighlighting,
  handleChangeReadingSpeed,
  resumeReading,
  stopReading,
  pauseReading,
  canEdit,
  isOwner,
  isVectorised,
  note,
}: {
  pageNumberInView: number;
  currentReadingSpeed: number;
  readingStatus: READING_STATUS;
  handleChangeReadingSpeed: () => Promise<void>;
  resumeReading: () => void;
  stopReading: () => void;
  pauseReading: () => void;
  startWordByWordHighlighting: (isContinueReading: boolean) => Promise<void>;
  canEdit: boolean;
  isOwner: boolean;
  isVectorised: boolean;
  note: string | null;
}) => {
  const browserSupportsSpeechSynthesis = "speechSynthesis" in window;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // for the mobile-view drawer
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <MotionConfig transition={transition}>
      <div
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50"
        ref={containerRef}
      >
        <div className="relative flex items-stretch gap-2">
          <div className="h-full w-full rounded-xl border border-zinc-950/10 bg-white">
            {/* <motion.div
          animate={
            {
              // @todo: here I want to remove the width
              // minWidth: isOpen ? "200px" : "30px",
            }
          }
          initial={false}
        > */}
            <div className="overflow-hidden py-1 px-1">
              {!isOpen ? (
                <div className="grid gap-1 w-full justify-evenly grid-cols-3 md:grid-cols-2">
                  {/* pageNumberInView is 0 initailly. */}
                  {pageNumberInView > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full hover:cursor-default"
                    >
                      {pageNumberInView}
                    </Button>
                  ) : (
                    <div className="h-7 w-7 bg-gray-200 animate-pulse m-auto rounded-md" />
                  )}

                  <Button
                    className="w-full"
                    onClick={() => setIsOpen(true)}
                    variant="ghost"
                    size="sm"
                    disabled={!browserSupportsSpeechSynthesis}
                  >
                    <AudioLinesIcon className="h-5 w-5" />
                  </Button>
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
                </div>
              ) : (
                <div className="flex space-x-2 w-fit items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  >
                    <ArrowLeftIcon className="h-5 w-5" />
                  </Button>
                  <div className="relative w-full">
                    <div className="gap-1 relative z-50 flex items-center rounded-lg">
                      {readingStatus === READING_STATUS.IDLE && (
                        <Button
                          onClick={() => startWordByWordHighlighting(false)}
                          variant="ghost"
                          className="px-3"
                        >
                          <PlayIcon className="h-5 w-5" />
                        </Button>
                      )}
                      {readingStatus === READING_STATUS.READING && (
                        <Button
                          onClick={pauseReading}
                          variant="ghost"
                          className="px-3"
                        >
                          <PauseIcon className="h-5 w-5" />
                        </Button>
                      )}

                      {readingStatus === READING_STATUS.PAUSED && (
                        <Button
                          onClick={resumeReading}
                          variant="ghost"
                          className="px-3"
                        >
                          <PlayIcon className="h-5 w-5" />
                        </Button>
                      )}

                      <Button
                        onClick={stopReading}
                        disabled={readingStatus === READING_STATUS.IDLE}
                        variant="ghost"
                        className="px-3"
                      >
                        <BanIcon className="h-5 w-5" />
                      </Button>

                      <Button
                        onClick={handleChangeReadingSpeed}
                        variant="ghost"
                        className="px-3"
                      >
                        {currentReadingSpeed}x
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* </motion.div> */}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
};

export default BottomToolbar;

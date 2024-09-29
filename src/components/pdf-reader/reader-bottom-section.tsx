import ReaderBottomToolbar from "@/components/pdf-reader/bottom-toolbar";
import { READING_STATUS } from "@/components/pdf-reader/constants";
import { Button } from "@/components/ui/button";
import { Ban, Pause, Play } from "lucide-react";

const ReaderBottomSection = ({
  pageNumberInView,
  currentReadingSpeed,
  readingStatus,
  startWordByWordHighlighting,
  handleChangeReadingSpeed,
  resumeReading,
  stopReading,
  pauseReading,
}: {
  pageNumberInView: number;
  currentReadingSpeed: number;
  readingStatus: READING_STATUS;
  handleChangeReadingSpeed: () => Promise<void>;
  resumeReading: () => void;
  stopReading: () => void;
  pauseReading: () => void;
  startWordByWordHighlighting: (isContinueReading: boolean) => Promise<void>;
}) => {
  const browserSupportsSpeechSynthesis = "speechSynthesis" in window;

  return (
    <ReaderBottomToolbar
      pageNumberInView={pageNumberInView}
      isAudioDisabled={!browserSupportsSpeechSynthesis}
    >
      <div className="gap-1 relative z-50 flex items-center rounded-lg">
        {readingStatus === READING_STATUS.IDLE && (
          <Button
            onClick={() => startWordByWordHighlighting(false)}
            variant="ghost"
            className="px-3"
          >
            <Play className="h-5 w-5" />
          </Button>
        )}
        {readingStatus === READING_STATUS.READING && (
          <Button onClick={pauseReading} variant="ghost" className="px-3">
            <Pause className="h-5 w-5" />
          </Button>
        )}

        {readingStatus === READING_STATUS.PAUSED && (
          <Button onClick={resumeReading} variant="ghost" className="px-3">
            <Play className="h-5 w-5" />
          </Button>
        )}

        <Button
          onClick={stopReading}
          disabled={readingStatus === READING_STATUS.IDLE}
          variant="ghost"
          className="px-3"
        >
          <Ban className="h-5 w-5" />
        </Button>

        <Button
          onClick={handleChangeReadingSpeed}
          variant="ghost"
          className="px-3"
        >
          {currentReadingSpeed}x
        </Button>
      </div>
    </ReaderBottomToolbar>
  );
};

export default ReaderBottomSection;

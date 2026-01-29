import { READING_STATUS } from "@/components/pdf-reader/constants";
import { Button } from "@/components/ui/button";
import { AudioLinesIcon, BanIcon, EyeIcon, PauseIcon, PlayIcon, SkipForwardIcon } from "lucide-react";

export const TTSControlsContent = ({
  readingStatus,
  startWordByWordHighlighting,
  pauseReading,
  resumeReading,
  stopReading,
  skipSentence,
  handleReadingSpeedChange,
  currentReadingSpeed,
  followAlongEnabled,
  toggleFollowAlong,
}: {
  readingStatus: READING_STATUS;
  startWordByWordHighlighting: (isContinueReading: boolean) => Promise<void>;
  pauseReading: () => void;
  resumeReading: () => void;
  stopReading: () => void;
  skipSentence: () => void;
  handleReadingSpeedChange: () => Promise<void>;
  currentReadingSpeed: number;
  followAlongEnabled: boolean;
  toggleFollowAlong: () => void;
}) => {
  return (
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
            onClick={skipSentence}
            disabled={readingStatus === READING_STATUS.IDLE}
            variant="ghost"
            size="xs"
            title="Skip sentence"
          >
            <SkipForwardIcon className="h-5 w-5" />
          </Button>
        </div>
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
          <Button onClick={handleReadingSpeedChange} variant="ghost" size="xs">
            {currentReadingSpeed}x
          </Button>
        </div>
        <div>
          <Button
            onClick={toggleFollowAlong}
            variant={followAlongEnabled ? "default" : "ghost"}
            size="xs"
            title={followAlongEnabled ? "Follow along (on)" : "Follow along (off)"}
          >
            <EyeIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const TTSControlsIcon = () => {
  const browserSupportsSpeechSynthesis = "speechSynthesis" in window;

  return (
    <Button
      variant="ghost"
      size="xs"
      disabled={!browserSupportsSpeechSynthesis}
    >
      <AudioLinesIcon className="h-5 w-5" />
    </Button>
  );
};

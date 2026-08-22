import { READING_STATUS } from "../constants";
import { Button } from "../../ui/button";
import { AudioLinesIcon, BanIcon, EyeIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react";

export const TTSControlsContent = ({
  readingStatus,
  startWordByWordHighlighting,
  pauseReading,
  resumeReading,
  stopReading,
  skipSentence,
  skipToPreviousSentence,
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
  skipToPreviousSentence: () => void;
  handleReadingSpeedChange: () => Promise<void>;
  currentReadingSpeed: number;
  followAlongEnabled: boolean;
  toggleFollowAlong: () => void;
}) => {
  return (
    <div className="relative w-full">
      <div className="gap-1 relative z-50 flex items-center rounded-lg">
        <div>
          <Button
            onClick={skipToPreviousSentence}
            disabled={readingStatus === READING_STATUS.IDLE}
            variant="ghost"
            size="xs"
            aria-label="Previous sentence"
            title="Previous sentence"
          >
            <SkipBackIcon aria-hidden="true" className="h-5 w-5" />
          </Button>
        </div>
        {readingStatus === READING_STATUS.IDLE && (
          <div>
            <Button
              onClick={() => startWordByWordHighlighting(false)}
              variant="ghost"
              size="xs"
              aria-label="Read"
              title="Read"
            >
              <PlayIcon aria-hidden="true" className="h-5 w-5" />
            </Button>
          </div>
        )}
        {readingStatus === READING_STATUS.READING && (
          <div>
            <Button
              onClick={pauseReading}
              variant="ghost"
              size="xs"
              aria-label="Pause"
              title="Pause"
            >
              <PauseIcon aria-hidden="true" className="h-5 w-5" />
            </Button>
          </div>
        )}

        {readingStatus === READING_STATUS.PAUSED && (
          <div>
            <Button
              onClick={resumeReading}
              variant="ghost"
              size="xs"
              aria-label="Resume"
              title="Resume"
            >
              <PlayIcon aria-hidden="true" className="h-5 w-5" />
            </Button>
          </div>
        )}
        <div>
          <Button
            onClick={skipSentence}
            disabled={readingStatus === READING_STATUS.IDLE}
            variant="ghost"
            size="xs"
            aria-label="Next sentence"
            title="Next sentence"
          >
            <SkipForwardIcon aria-hidden="true" className="h-5 w-5" />
          </Button>
        </div>
        <div>
          <Button
            onClick={stopReading}
            disabled={readingStatus === READING_STATUS.IDLE}
            variant="ghost"
            size="xs"
            aria-label="Stop reading"
            title="Stop reading"
          >
            <BanIcon aria-hidden="true" className="h-5 w-5" />
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
            aria-label={
              followAlongEnabled ? "Disable follow along" : "Enable follow along"
            }
            title={followAlongEnabled ? "Follow along (on)" : "Follow along (off)"}
          >
            <EyeIcon aria-hidden="true" className="h-5 w-5" />
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
      aria-label="Text to speech"
      title="Text to speech"
    >
      <AudioLinesIcon aria-hidden="true" className="h-5 w-5" />
    </Button>
  );
};

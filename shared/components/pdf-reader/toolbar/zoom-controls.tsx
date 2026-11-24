import { Button } from "../../ui/button";
import { Slider } from "../../ui/slider";
import { MinusIcon, PlusIcon, ZoomInIcon } from "lucide-react";
import { useState } from "react";

const DEFAULT_MIN_ZOOM_PERCENT = 50;
const DEFAULT_MAX_ZOOM_PERCENT = 200;
const ZOOM_STEP_PERCENT = 10;

const stepDown = (percent: number) =>
  Math.floor(percent / ZOOM_STEP_PERCENT) * ZOOM_STEP_PERCENT;
const stepUp = (percent: number) =>
  Math.ceil(percent / ZOOM_STEP_PERCENT) * ZOOM_STEP_PERCENT;

export const ZoomControlsContent = ({
  currentZoom,
  onZoomChange,
}: {
  // Null until the viewer reports its scale — a document opened at "auto" fits
  // to width, so there is no honest percentage to show before then.
  currentZoom: number | null;
  onZoomChange: (zoom: number) => void;
}) => {
  const percent = currentZoom === null ? null : Math.round(currentZoom * 100);
  const [range, setRange] = useState({
    min: DEFAULT_MIN_ZOOM_PERCENT,
    max: DEFAULT_MAX_ZOOM_PERCENT,
  });
  if (percent !== null && (percent < range.min || percent > range.max)) {
    setRange({
      min: Math.min(range.min, stepDown(percent)),
      max: Math.max(range.max, stepUp(percent)),
    });
  }
  const stepTo = (target: number) =>
    onZoomChange(Math.min(range.max, Math.max(range.min, target)) / 100);

  return (
    <div className="flex h-9 items-center gap-1 px-1">
      <Button
        variant="ghost"
        size="xs"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={percent === null || percent <= range.min}
        onClick={() =>
          percent !== null && stepTo(stepUp(percent) - ZOOM_STEP_PERCENT)
        }
      >
        <MinusIcon aria-hidden="true" className="h-4 w-4" />
      </Button>
      {percent === null ? (
        <div className="h-1.5 w-32 animate-pulse rounded-full bg-muted" />
      ) : (
        <Slider
          aria-label="Zoom level"
          value={[percent]}
          onValueChange={(value) => onZoomChange((value[0] ?? percent) / 100)}
          min={range.min}
          max={range.max}
          step={ZOOM_STEP_PERCENT}
          className="w-32"
        />
      )}
      <Button
        variant="ghost"
        size="xs"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={percent === null || percent >= range.max}
        onClick={() =>
          percent !== null && stepTo(stepDown(percent) + ZOOM_STEP_PERCENT)
        }
      >
        <PlusIcon aria-hidden="true" className="h-4 w-4" />
      </Button>
      <span className="w-11 text-right text-sm font-medium tabular-nums">
        {percent === null ? (
          <span className="ml-auto block h-4 w-9 animate-pulse rounded-md bg-muted" />
        ) : (
          `${percent}%`
        )}
      </span>
    </div>
  );
};

export const ZoomControlsIcon = () => {
  return (
    <Button
      variant="ghost"
      size="xs"
      className="block"
      aria-label="Zoom"
      title="Zoom"
    >
      <ZoomInIcon aria-hidden="true" className="h-5 w-5" />
    </Button>
  );
};

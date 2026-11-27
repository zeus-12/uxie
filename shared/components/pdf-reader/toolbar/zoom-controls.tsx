import { Button } from "../../ui/button";
import { Slider } from "../../ui/slider";
import { MinusIcon, PlusIcon, WrapTextIcon, ZoomInIcon } from "lucide-react";
import { clampZoom, ZOOM_STEP } from "../../../lib/reader-zoom";

export const ZoomControlsContent = ({
  currentZoom,
  onZoomChange,
}: {
  // Null until the viewer reports its scale — a document opened at "auto" fits
  // to width, so there is no honest percentage to show before then.
  currentZoom: number | null;
  onZoomChange: (zoom: number) => void;
}) => {
  if (currentZoom === null) {
    return (
      <div className="gap-2 flex items-center">
        <div className="h-4 w-9 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="gap-2 flex items-center">
      <p className="text-sm font-medium tabular-nums">{Math.round(currentZoom * 100)}%</p>

      <Button
        variant="ghost"
        size="xs"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={() => onZoomChange(clampZoom(currentZoom / ZOOM_STEP))}
      >
        <MinusIcon aria-hidden="true" className="size-4" />
      </Button>

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

      <Button
        variant="ghost"
        size="xs"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={() => onZoomChange(clampZoom(currentZoom * ZOOM_STEP))}
      >
        <PlusIcon aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
};

export const ZoomControlsIcon = ({ reflowed }: { reflowed: boolean }) => {
  const label = reflowed ? "Zoom (text reflowed to fit)" : "Zoom";
  return (
    <Button
      variant="ghost"
      size="xs"
      className="block"
      aria-label={label}
      title={label}
    >
      {reflowed ? (
        <WrapTextIcon aria-hidden="true" className="h-5 w-5" />
      ) : (
        <ZoomInIcon aria-hidden="true" className="h-5 w-5" />
      )}
    </Button>
  );
};

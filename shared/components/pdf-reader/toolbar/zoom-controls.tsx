import { Button } from "../../ui/button";
import { Slider } from "../../ui/slider";
import { ZoomInIcon } from "lucide-react";

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
        <div className="bg-gray-200 h-4 w-9 animate-pulse rounded-md" />
        <div className="bg-gray-200 h-4 w-24 animate-pulse rounded-md" />
      </div>
    );
  }

  return (
    <div className="gap-2 flex">
      <p className="text-sm font-medium">{Math.round(currentZoom * 100)}%</p>

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

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomInIcon } from "lucide-react";

export const ZoomControlsContent = ({
  currentZoom,
  onZoomChange,
}: {
  currentZoom: number;
  onZoomChange: (zoom: number) => void;
}) => {
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
    <Button variant="ghost" size="xs" className="block">
      <ZoomInIcon className="h-5 w-5" />
    </Button>
  );
};

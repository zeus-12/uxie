import { PaletteIcon } from "lucide-react";

import { Button } from "../../ui/button";
import { CustomTooltip } from "../../ui/tooltip";
import { PDF_BACKGROUND_COLOURS } from "../../../lib/constants";
import { type PageColour } from "../../../lib/store";
import { cn } from "../../../lib/utils";

const PAGE_TINT_NAMES: Record<(typeof PDF_BACKGROUND_COLOURS)[number], string> =
  {
    "#FFF": "White",
    "#DBEAFE": "Blue",
    "#CFFAFE": "Cyan",
    "#D1FAE5": "Green",
    "#FEF9C3": "Yellow",
    "#FFEDD5": "Orange",
  };

const SELECTED_RING = "ring-2 ring-primary ring-offset-2 ring-offset-popover";

function ThemePageChip() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-6 items-center justify-center rounded-md"
    >
      <PaletteIcon className="h-5 w-5" />
    </span>
  );
}

export const BackgroundControlsContent = ({
  pageColourChangeHandler,
  pageColour,
}: {
  pageColourChangeHandler: (colour: PageColour) => void;
  pageColour: PageColour;
}) => {
  return (
    <div
      role="group"
      aria-label="Page colour"
      className="flex items-center gap-2 px-1.5 py-1"
    >
      {PDF_BACKGROUND_COLOURS.map((colour) => (
        <CustomTooltip key={colour} content={PAGE_TINT_NAMES[colour]} asChild>
          <button
            type="button"
            aria-pressed={colour === pageColour}
            aria-label={PAGE_TINT_NAMES[colour]}
            onClick={() => pageColourChangeHandler(colour)}
            className={cn(
              "size-6 rounded-md ring-1 ring-inset ring-black/15 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              colour === pageColour && SELECTED_RING,
            )}
            style={{ backgroundColor: colour }}
          />
        </CustomTooltip>
      ))}
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
      <CustomTooltip content="Use the app theme's page colours" asChild>
        <button
          type="button"
          aria-label="Theme"
          aria-pressed={pageColour === "theme"}
          onClick={() => pageColourChangeHandler("theme")}
          className={cn(
            "rounded-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pageColour === "theme" && SELECTED_RING,
          )}
        >
          <ThemePageChip />
        </button>
      </CustomTooltip>
    </div>
  );
};

export const BackgroundControlsIcon = ({
  pageColour,
}: {
  pageColour: PageColour;
}) => {
  const label = pageColour === "theme" ? "Theme" : PAGE_TINT_NAMES[pageColour];

  if (pageColour === "theme") {
    return (
      <Button
        variant="ghost"
        size="xs"
        className="block"
        aria-label={`Page colour: ${label}`}
      >
        <PaletteIcon aria-hidden="true" className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Page colour: ${label}`}
      className="inline-flex size-6 rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="size-6 rounded-[5px] ring-1 ring-inset ring-black/15"
        style={{ backgroundColor: pageColour }}
      />
    </button>
  );
};

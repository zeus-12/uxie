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

function ThemePageChip({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-[5px] bg-background text-[11px] font-semibold leading-none text-foreground ring-1 ring-inset ring-foreground/20",
        className,
      )}
    >
      Aa
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
      role="radiogroup"
      aria-label="Page colour"
      className="flex items-center gap-2 px-1.5"
    >
      {PDF_BACKGROUND_COLOURS.map((colour) => (
        <CustomTooltip key={colour} content={PAGE_TINT_NAMES[colour]} asChild>
          <button
            type="button"
            role="radio"
            aria-checked={colour === pageColour}
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
          role="radio"
          aria-checked={pageColour === "theme"}
          onClick={() => pageColourChangeHandler("theme")}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md py-0.5 pl-0.5 pr-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pageColour === "theme" && "bg-muted text-foreground hover:bg-muted",
          )}
        >
          <ThemePageChip
            className={cn(
              "size-6",
              pageColour === "theme" && "ring-2 ring-primary ring-inset",
            )}
          />
          Theme
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
  if (pageColour === "theme") {
    return (
      <span aria-label="Page colour: theme" className="inline-flex size-6">
        <ThemePageChip className="size-6" />
      </span>
    );
  }

  return (
    <span
      aria-label={`Page colour: ${PAGE_TINT_NAMES[pageColour]}`}
      className="inline-flex size-6 rounded-[5px] ring-1 ring-inset ring-black/15"
      style={{ backgroundColor: pageColour }}
    />
  );
};

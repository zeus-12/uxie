import { Button } from "../../ui/button";
import { PDF_BACKGROUND_COLOURS } from "../../../lib/constants";

export const BackgroundControlsContent = ({
  pageColourChangeHandler,
  pageColour,
}: {
  pageColourChangeHandler: (colour: string) => void;
  pageColour: string;
}) => {
  return (
    <div className="flex gap-2">
      {PDF_BACKGROUND_COLOURS.filter((colour) => colour !== pageColour).map(
        (colour) => (
          <button
            type="button"
            onClick={() => pageColourChangeHandler(colour)}
            key={colour}
            className="h-6 w-6 rounded-md outline outline-1 outline-black/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={{ backgroundColor: colour }}
            aria-label={`Use ${colour} reader background`}
          />
        ),
      )}
    </div>
  );
};

const OFFSHADE_COLOUR = "#F3F4F6";

export const BackgroundControlsIcon = ({
  pageColour,
}: {
  pageColour: string;
}) => {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="w-6 h-6"
      style={{
        backgroundColor:
          pageColour === PDF_BACKGROUND_COLOURS[0]
            ? OFFSHADE_COLOUR
            : pageColour,
      }}
      aria-label="Reader background colour"
    />
  );
};

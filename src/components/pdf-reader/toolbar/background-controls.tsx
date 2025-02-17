import { PDF_BACKGROUND_COLOURS } from "@/lib/constants";

export const BackgroundControlsContent = ({
  pageColourChangeHandler,
  pageColour,
}: {
  pageColourChangeHandler: (colour: string) => void;
  pageColour: string;
}) => {
  return (
    <div className="flex gap-2 cursor-pointer">
      {PDF_BACKGROUND_COLOURS.filter((colour) => colour !== pageColour).map(
        (colour) => (
          <div
            onClick={() => pageColourChangeHandler(colour)}
            key={colour}
            className="w-6 h-6 rounded-md"
            style={{ backgroundColor: colour }}
          />
        ),
      )}
    </div>
  );
};

export const BackgroundControlsIcon = ({
  pageColour,
}: {
  pageColour: string;
}) => {
  return (
    <div
      className="w-6 h-6 rounded-md cursor-pointer"
      style={{
        backgroundColor:
          pageColour === PDF_BACKGROUND_COLOURS[0] ? "#F3F4F6" : pageColour,
      }}
    />
  );
};

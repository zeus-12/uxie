import { Highlighter } from "lucide-react";

export const HighlightPopover = ({
  // onOpen,
  onConfirm,
}: {
  // onOpen: any;
  onConfirm: any;
}) => {
  return (
    <div className="rounded-full bg-gray-200  text-black">
      <Highlighter
        size={24}
        className="hover:cursor-pointer"
        onClick={onConfirm}
      />
    </div>
  );
};

export default HighlightPopover;

import { TrashIcon } from "lucide-react";

export const HighlightPopup = ({
  id,
  deleteHighlight,
}: {
  id: string;
  deleteHighlight: any;
}) => {
  return (
    <div className="rounded-full bg-gray-200  text-black">
      <TrashIcon
        size={24}
        className="hover:cursor-pointer"
        onClick={() => {
          deleteHighlight(id);
        }}
      />
    </div>
  );
};

export default HighlightPopup;

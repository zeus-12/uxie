import { TrashIcon } from "lucide-react";
import type {
  Highlight,
  ViewportHighlight,
} from "react-pdf-highlighter-extended";

// const HighlightPopup = ({ highlight }: HighlightPopupProps) => {
//   return <div className="Highlight__popup">Comment has no Text</div>;
// };

const HighlightPopup = ({
  id,
  deleteHighlight,
} // hideTip,
: {
  id: string;
  deleteHighlight: any;
  // hideTip: () => void;
}) => {
  const OPTIONS = [
    {
      onClick: () => {
        deleteHighlight(id);
        // hideTip();
      },
      icon: TrashIcon,
    },
  ];

  return (
    <div className="relative rounded-md bg-black">
      <div className="absolute -bottom-[10px] left-[50%] h-0 w-0 -translate-x-[50%] border-l-[10px] border-r-[10px] border-t-[10px] border-solid border-black border-l-transparent border-r-transparent " />

      <div className="flex divide-x divide-gray-800">
        {OPTIONS.map((option, id) => (
          <div
            className="group p-2 hover:cursor-pointer"
            key={id}
            onClick={option.onClick}
          >
            <option.icon
              size={18}
              className="rounded-full text-gray-300 group-hover:text-gray-50"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default HighlightPopup;

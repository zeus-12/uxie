import { copyTextToClipboard } from "@/lib/utils";
import { ClipboardCopy, Highlighter } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";
import {
  GhostHighlight,
  PdfSelection,
  usePdfHighlighterContext,
} from "react-pdf-highlighter-extended";

interface ExpandableTipProps {
  addHighlight: (highlight: GhostHighlight) => void;
}

const ExpandableTip = ({ addHighlight }: ExpandableTipProps) => {
  const selectionRef = useRef<PdfSelection | null>(null);

  const {
    getCurrentSelection,
    removeGhostHighlight,
    setTip,
    updateTipPosition,
  } = usePdfHighlighterContext();

  useLayoutEffect(() => {
    updateTipPosition!();
  }, []);

  return (
    <div className="Tip">
      <TextSelectionPopover
        addHighlight={() =>
          addHighlight()
          // { content, position }
        }
        hideTipAndSelection={() => setTip(null)}
        content={{ text: "acb" }}
      />
    </div>
  );
};

const TextSelectionPopover = ({
  content,
  hideTipAndSelection,
  addHighlight,
}: {
  position: any;
  addHighlight: () => void;
  content: {
    text?: string | undefined;
    image?: string | undefined;
  };
  hideTipAndSelection: () => void;
}) => {
  const OPTIONS = [
    {
      onClick: () => {
        addHighlight();
        hideTipAndSelection();
      },
      icon: Highlighter,
    },
    {
      onClick: () => {
        copyTextToClipboard(content.text, hideTipAndSelection);
      },
      icon: ClipboardCopy,
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

export default ExpandableTip;

interface CommentFormProps {
  onSubmit: (input: string) => void;
  placeHolder?: string;
}

export const CommentForm = ({ onSubmit, placeHolder }: CommentFormProps) => {
  const [input, setInput] = useState<string>("");

  return (
    <form
      className="Tip__card"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(input);
      }}
    >
      <div>
        <textarea
          placeholder={placeHolder}
          autoFocus
          onChange={(event) => {
            setInput(event.target.value);
          }}
        />
      </div>
      <div>
        <input type="submit" value="Save" />
      </div>
    </form>
  );
};

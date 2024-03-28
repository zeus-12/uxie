import { defaultProps, PropSchema } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";

export const highlightPropSchema = {
  textAlignment: defaultProps.textAlignment,
  textColor: defaultProps.textColor,
  highlightId: {
    default: "",
  },
} satisfies PropSchema;

export const HighlighBlock = createReactBlockSpec(
  {
    type: "highlight",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
      highlightId: {
        default: "",
      },
    },
    content: "inline",
  },
  {
    render: (props) => (
      <div className="flex h-full max-w-full flex-1 items-center gap-2 rounded-sm p-1">
        <div
          onClick={() => {
            if (!props?.block?.props?.highlightId) return;
            document.location.hash = props.block.props.highlightId;
          }}
          className="h-full w-2 rounded-full bg-yellow-400 hover:cursor-pointer"
        />
        <div className="flex-1">
          <div className="inline-content" ref={props.contentRef} />
        </div>
      </div>
    ),
  },
);

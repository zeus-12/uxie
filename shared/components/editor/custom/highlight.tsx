import { defaultProps, type PropSchema } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useHighlightJumpStore } from "../../../lib/store";

export const highlightPropSchema = {
  textAlignment: defaultProps.textAlignment,
  textColor: defaultProps.textColor,
  highlightId: {
    default: "",
  },
  // Kept alongside the id so an orphaned block (its highlight was deleted) can
  // still take you to the right page.
  pageNumber: {
    default: 0,
  },
} satisfies PropSchema;

export const HighlighBlock = createReactBlockSpec(
  {
    type: "highlight",
    propSchema: highlightPropSchema,
    content: "inline",
  },
  {
    render: (props) => (
      <div className="flex h-full w-full items-stretch gap-2 rounded-sm p-1">
        <div
          onClick={() => {
            const { highlightId, pageNumber } = props.block.props;
            if (!highlightId) return;
            useHighlightJumpStore
              .getState()
              .jumpToHighlight?.(highlightId, pageNumber || undefined);
          }}
          className="w-2 rounded-full bg-yellow-400 hover:cursor-pointer"
        />
        <div className="flex-1">
          <div className="inline-content" ref={props.contentRef} />
        </div>
      </div>
    ),
    toExternalHTML: (props) => {
      const highlightText =
        props.block.content?.[0] && "text" in props.block.content?.[0]
          ? props.block.content?.[0]?.text
          : "";
      // todo: add styles to maake it look like a highlight
      return <p>{highlightText}</p>;
    },
  },
);

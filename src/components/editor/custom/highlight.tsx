import { defaultProps, PropSchema } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";

export const highlightPropSchema = {
  textAlignment: defaultProps.textAlignment,
  textColor: defaultProps.textColor,
  highlightId: {
    default: "",
  },
  pageNumber: {
    default: "1",
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
            if (!props?.block?.props?.highlightId) return;

            const { pageNumber, highlightId } = props.block.props;

            const currentHash = document.location.hash;
            const newHash = `#page=${pageNumber}&highlight=${highlightId}`;

            // Prevent scroll jump if the hash is already correct
            if (currentHash === newHash) return;

            document.location.hash = newHash;
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

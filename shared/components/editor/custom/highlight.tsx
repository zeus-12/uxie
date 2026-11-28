import { defaultProps, type PropSchema } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useHighlightColorStore, useHighlightJumpStore } from "../../../lib/store";
import { cn } from "../../../lib/utils";

const HighlightMarker = ({
  highlightId,
  pageNumber,
}: {
  highlightId: string;
  pageNumber: number;
}) => {
  const color = useHighlightColorStore((s) => s.colors.get(highlightId));
  return (
    <div
      data-swatch={color}
      onClick={() => {
        if (!highlightId) return;
        useHighlightJumpStore
          .getState()
          .jumpToHighlight?.(highlightId, pageNumber || undefined);
      }}
      className={cn(
        "w-2 rounded-full hover:cursor-pointer",
        color ? "bg-[var(--uxie-swatch)]" : "bg-border",
      )}
    />
  );
};

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
        <HighlightMarker
          highlightId={props.block.props.highlightId}
          pageNumber={props.block.props.pageNumber}
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
      return <p>{highlightText}</p>;
    },
  },
);

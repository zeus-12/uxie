import {
  BlockNoteEditor,
  BlockSpec,
  DefaultBlockSchema,
  defaultProps,
  PropSchema,
  SpecificBlock,
} from "@blocknote/core";
import { createReactBlockSpec, InlineContent } from "@blocknote/react";

// The props for the Highlight block
export const highlightPropSchema = {
  textAlignment: defaultProps.textAlignment,
  textColor: defaultProps.textColor,
  highlightId: {
    default: "",
  },
} satisfies PropSchema;

export const Highlight = (props: {
  block: SpecificBlock<
    DefaultBlockSchema & {
      highlight: BlockSpec<"highlight", typeof highlightPropSchema, true>;
    },
    "highlight"
  >;
  editor: BlockNoteEditor<
    DefaultBlockSchema & {
      highlight: BlockSpec<"highlight", typeof highlightPropSchema, true>;
    }
  >;
  theme: "light" | "dark";
  // highlightId: string;
}) => {
  return (
    <div
      className="flex h-full max-w-full flex-1 items-center justify-center gap-2"
      style={{
        ...highlightStyles,
      }}
    >
      <div
        onClick={() => {
          if (!props?.block?.props?.highlightId) return;
          // todo check whether the "highlight-" is even required
          document.location.hash = props.block.props.highlightId;
        }}
        className="h-full w-4 rounded-full bg-yellow-400 hover:cursor-pointer"
      />
      <InlineContent className="break-word-overflow flex-grow" />
    </div>
  );
};

export const createHighlightBlock = (theme: "light" | "dark") =>
  createReactBlockSpec<
    "highlight",
    typeof highlightPropSchema,
    true,
    DefaultBlockSchema & {
      highlight: BlockSpec<"highlight", typeof highlightPropSchema, true>;
    }
  >({
    type: "highlight" as const,
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
      highlightId: {
        default: "",
      },
    } as const,
    containsInlineContent: true,
    render: (props) => <Highlight {...props} theme={theme} />,
  });

// Slash menu item to insert an highlight block
// export const insertHighlight = {
//   name: "Highlight",
//   execute: (editor) => {
//     const block = editor.getTextCursorPosition().block;
//     const blockIsEmpty = block.content.length === 0;

//     // Updates current block to an highlight if it's empty, otherwise inserts a new
//     // one below
//     if (blockIsEmpty) {
//       editor.updateBlock(block, { type: "highlight" });
//     } else {
//       editor.insertBlocks(
//         [
//           {
//             type: "highlight",
//           },
//         ],
//         editor.getTextCursorPosition().block,
//         "after",
//       );
//       editor.setTextCursorPosition(editor.getTextCursorPosition().nextBlock!);
//     }
//   },
//   aliases: ["highlight", "annotate"],
//   group: "Other",
//   icon: <HighlighterIcon />,
//   hint: "Display highlighted texts from PDF",
// } satisfies ReactSlashMenuItem<
//   DefaultBlockSchema & {
//     highlight: BlockSpec<"highlight", typeof highlightPropSchema>;
//   }
// >;

const highlightStyles = {
  borderRadius: "4px",
  padding: "4px",
} as const;

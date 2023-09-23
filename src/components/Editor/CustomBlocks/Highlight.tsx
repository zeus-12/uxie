import {
  BlockNoteEditor,
  BlockSpec,
  DefaultBlockSchema,
  defaultProps,
  PropSchema,
  SpecificBlock,
} from "@blocknote/core";
import {
  createReactBlockSpec,
  InlineContent,
  ReactSlashMenuItem,
} from "@blocknote/react";
import { HighlighterIcon } from "lucide-react";
import { useState } from "react";

// import { MdCancel, MdCheckCircle, MdError, MdInfo } from "react-icons/md";
// import { Menu } from "@mantine/core";

// The types of highlight that users can choose from
// export const highlightTypes = {
//   warning: {
//     icon: MdError,
//     color: "#e69819",
//     backgroundColor: {
//       light: "#fff6e6",
//       dark: "#805d20",
//     },
//   },
//   error: {
//     icon: MdCancel,
//     color: "#d80d0d",
//     backgroundColor: {
//       light: "#ffe6e6",
//       dark: "#802020",
//     },
//   },
//   info: {
//     icon: MdInfo,
//     color: "#507aff",
//     backgroundColor: {
//       light: "#e6ebff",
//       dark: "#203380",
//     },
//   },
//   success: {
//     icon: MdCheckCircle,
//     color: "#0bc10b",
//     backgroundColor: {
//       light: "#e6ffe6",
//       dark: "#208020",
//     },
//   },
// } as const;

// The props for the Highlight block
export const highlightPropSchema = {
  textAlignment: defaultProps.textAlignment,
  textColor: defaultProps.textColor,
} satisfies PropSchema;

export const Highlight = (props: {
  block: SpecificBlock<
    DefaultBlockSchema & {
      highlight: BlockSpec<"highlight", typeof highlightPropSchema>;
    },
    "highlight"
  >;
  editor: BlockNoteEditor<
    DefaultBlockSchema & {
      highlight: BlockSpec<"highlight", typeof highlightPropSchema>;
    }
  >;
  theme: "light" | "dark";
}) => {
  return (
    <div
      className={"highlight "}
      style={{
        ...highlightStyles,
      }}
    >
      <div className="h-full w-2 rounded-full bg-yellow-200" />
      <InlineContent style={inlineContentStyles} />
    </div>
  );
};

// Function which creates the highlight block itself, where the component is styled
// correctly with the light & dark theme
export const createHighlightBlock = (theme: "light" | "dark") =>
  createReactBlockSpec<
    "highlight",
    typeof highlightPropSchema,
    true,
    DefaultBlockSchema & {
      highlight: BlockSpec<"highlight", typeof highlightPropSchema>;
    }
  >({
    type: "highlight" as const,
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
    } as const,
    containsInlineContent: true,
    render: (props) => <Highlight {...props} theme={theme} />,
  });

// Slash menu item to insert an highlight block
export const insertHighlight = {
  name: "Highlight",
  execute: (editor) => {
    const block = editor.getTextCursorPosition().block;
    const blockIsEmpty = block.content.length === 0;

    // Updates current block to an highlight if it's empty, otherwise inserts a new
    // one below
    if (blockIsEmpty) {
      editor.updateBlock(block, { type: "highlight" });
    } else {
      editor.insertBlocks(
        [
          {
            type: "highlight",
          },
        ],
        editor.getTextCursorPosition().block,
        "after",
      );
      editor.setTextCursorPosition(editor.getTextCursorPosition().nextBlock!);
    }
  },
  aliases: ["highlight", "annotate"],
  group: "Other",
  icon: <HighlighterIcon />,
  hint: "Display highlighted texts from PDF",
} satisfies ReactSlashMenuItem<
  DefaultBlockSchema & {
    highlight: BlockSpec<"highlight", typeof highlightPropSchema>;
  }
>;

const highlightStyles = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexGrow: 1,
  borderRadius: "4px",
  height: "48px",
  padding: "4px",
} as const;

const inlineContentStyles = {
  flexGrow: "1",
};

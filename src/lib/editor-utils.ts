import { AlertBlock, insertAlert } from "@/components/editor/custom/alert";
// import { Comment } from "@/components/Editor/CustomBlocks/Comment";
import { HighlighBlock } from "@/components/editor/custom/highlight";
import { BlockNoteEditorType } from "@/types/editor";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from "@blocknote/core";
import {
  DefaultReactSuggestionItem,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";

// export const getPrevText = (
//   editor: BlockNoteEditorType["_tiptapEditor"],
//   {
//     chars,
//     offset = 0,
//   }: {
//     chars: number;
//     offset?: number;
//   },
// ) => {
//   return editor.state.doc.textBetween(
//     Math.max(0, editor.state.selection.from - chars),
//     editor.state.selection.from - offset,
//     "\n",
//   );
// };

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    alert: AlertBlock,
    highlight: HighlighBlock,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    // comment: Comment,
  },
});

export const getSlashMenuItems = (
  editor: BlockNoteEditorType,
): DefaultReactSuggestionItem[] => [
  ...getDefaultReactSlashMenuItems(editor),
  insertAlert(editor),
];

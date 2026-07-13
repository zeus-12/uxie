import { AlertBlock, insertAlert } from "../components/editor/custom/alert";
import { HighlighBlock } from "../components/editor/custom/highlight";
import { type BlockNoteEditorType } from "../types/editor";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from "@blocknote/core";
import {
  type DefaultReactSuggestionItem,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";

const { audio, video, file, ...remainingBlockSpecs } = defaultBlockSpecs;

const blockSpecs = {
  ...remainingBlockSpecs,
  alert: AlertBlock,
  highlight: HighlighBlock,
};

export const schema = BlockNoteSchema.create({
  blockSpecs,
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
  },
});

export const getSlashMenuItems = (
  editor: BlockNoteEditorType,
): DefaultReactSuggestionItem[] => [
  ...getDefaultReactSlashMenuItems(editor),
  insertAlert(editor),
];

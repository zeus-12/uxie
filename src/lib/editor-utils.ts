import {
  alertBlock,
  insertAlert,
} from "@/components/Editor/CustomBlocks/Alert";
import { highlightBlock } from "@/components/Editor/CustomBlocks/Highlight";
import { BlockNoteEditorType } from "@/types/editor";
import { getBlockSchemaFromSpecs, defaultBlockSpecs } from "@blocknote/core";
import {
  defaultBlockTypeDropdownItems,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { AlertCircle } from "lucide-react";

export const blockTypeDropdownItems = [
  ...defaultBlockTypeDropdownItems,
  {
    name: "Alert",
    type: "alert",
    icon: AlertCircle,
  },
];

export const blockSpecs = {
  ...defaultBlockSpecs,
  alert: alertBlock,
  highlight: highlightBlock,
};

export const blockSchema = getBlockSchemaFromSpecs(blockSpecs);

export const slashMenuItems = [
  ...getDefaultReactSlashMenuItems(blockSchema),
  insertAlert,
];

export const getPrevText = (
  editor: BlockNoteEditorType["_tiptapEditor"],
  {
    chars,
    offset = 0,
  }: {
    chars: number;
    offset?: number;
  },
) => {
  return editor.state.doc.textBetween(
    Math.max(0, editor.state.selection.from - chars),
    editor.state.selection.from - offset,
    "\n",
  );
};

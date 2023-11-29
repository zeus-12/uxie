import { schemaWithCustomBlocks } from "@/lib/editor-utils";
import { BlockNoteEditor } from "@blocknote/core";

export type BlockNoteEditorType = BlockNoteEditor<
  typeof schemaWithCustomBlocks
>;

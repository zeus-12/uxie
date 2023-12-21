import { blockSchema } from "@/lib/editor-utils";
import { BlockNoteEditor } from "@blocknote/core";
import * as Y from "yjs";

export type BlockNoteEditorType = BlockNoteEditor<typeof blockSchema>;

export type YjsEditorProps = {
  doc: Y.Doc;
  provider: any;
  canEdit: boolean;
  username: string;
};

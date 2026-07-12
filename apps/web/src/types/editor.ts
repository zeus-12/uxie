import { schema } from "@/lib/editor-utils";
import * as Y from "yjs";

export type BlockNoteEditorType = typeof schema.BlockNoteEditor;

export type YjsEditorProps = {
  doc: Y.Doc;
  provider: any;
  canEdit: boolean;
  username: string;
};

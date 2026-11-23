import { exportFilename } from "./export-filename";

export const NOTES_MARKDOWN_TYPE = "text/markdown";

export function notesFilename(title: string | null): string {
  return exportFilename(title, "notes.md");
}

export function notesToMarkdown<Block>(editor: {
  document: Block[];
  blocksToMarkdownLossy: (blocks: Block[]) => Promise<string>;
}): Promise<string> {
  return editor.blocksToMarkdownLossy(editor.document);
}

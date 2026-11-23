import { exportFilename } from "./export-filename";

export const NOTES_MARKDOWN_TYPE = "text/markdown";

type NoteBlock = {
  props?: Record<string, unknown>;
  children?: NoteBlock[];
};

export type ResolveNoteFileUrl = (url: string) => Promise<string>;

export function notesFilename(title: string | null): string {
  return exportFilename(title, "notes.md");
}

async function withResolvedFileUrls<Block extends NoteBlock>(
  blocks: Block[],
  resolveFileUrl: ResolveNoteFileUrl,
): Promise<Block[]> {
  return Promise.all(
    blocks.map(async (block) => {
      const url = block.props?.url;
      return {
        ...block,
        ...(typeof url === "string" && url
          ? { props: { ...block.props, url: await resolveFileUrl(url) } }
          : {}),
        ...(block.children
          ? {
              children: await withResolvedFileUrls(
                block.children,
                resolveFileUrl,
              ),
            }
          : {}),
      };
    }),
  );
}

export async function notesToMarkdown<Block extends NoteBlock>(
  editor: {
    document: Block[];
    blocksToMarkdownLossy: (blocks: Block[]) => Promise<string>;
  },
  resolveFileUrl?: ResolveNoteFileUrl,
): Promise<string> {
  const blocks = resolveFileUrl
    ? await withResolvedFileUrls(editor.document, resolveFileUrl)
    : editor.document;
  return editor.blocksToMarkdownLossy(blocks);
}

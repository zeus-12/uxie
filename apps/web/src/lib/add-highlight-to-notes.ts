import type { BlockNoteEditorType } from "@/types/editor";
import { HighlightContentType } from "@/types/highlight";
import { toast } from "sonner";

export const addHighlightToNotes = async ({
  content,
  highlightId,
  type,
  editor,
  canEdit,
  pageNumber,
}: {
  content: string;
  highlightId: string;
  type: HighlightContentType;
  editor: BlockNoteEditorType | null;
  canEdit: boolean;
  pageNumber?: number;
}) => {
  if (!editor) {
    toast.error("Couldn't add the highlight to notes. Try reloading the page.");
    return;
  }
  if (!canEdit) {
    toast.error("You do not have permission to edit this document.");
    return;
  }

  const lastBlock = editor.document[editor.document.length - 1];
  if (!content || !highlightId || !lastBlock) return;

  if (type === HighlightContentType.TEXT) {
    try {
      editor.insertBlocks(
        [
          {
            type: "highlight",
            content,
            props: {
              highlightId,
              ...(pageNumber ? { pageNumber } : {}),
            },
          },
        ],
        lastBlock,
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The note could not be updated.",
      );
    }
    return;
  }

  if (!editor.uploadFile) return;
  const base64StringWithoutHeader = content.split(",")[1];
  if (!base64StringWithoutHeader) {
    toast.error("Invalid image");
    return;
  }

  const byteArray = Uint8Array.from(
    atob(base64StringWithoutHeader),
    (character) => character.charCodeAt(0),
  );
  const file = new File([byteArray], `${highlightId}.png`, {
    type: "image/png",
  });
  const uploadedUrl: unknown = await editor.uploadFile(file);
  if (typeof uploadedUrl !== "string") {
    toast.error("The highlight image could not be uploaded.");
    return;
  }

  try {
    editor.insertBlocks(
      [{ props: { url: uploadedUrl }, type: "image" }],
      lastBlock,
    );
  } catch (error: unknown) {
    toast.error(
      error instanceof Error ? error.message : "The note could not be updated.",
    );
  }
};

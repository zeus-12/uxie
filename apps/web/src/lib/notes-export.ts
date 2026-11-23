import {
  NOTES_MARKDOWN_TYPE,
  notesFilename,
} from "@uxie/shared/lib/notes-export";
import { saveAs } from "file-saver";

export async function downloadNotes(markdown: string, title: string | null) {
  saveAs(
    new Blob([markdown], { type: NOTES_MARKDOWN_TYPE }),
    notesFilename(title),
  );
}

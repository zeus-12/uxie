import { notesFilename } from "@uxie/shared/lib/notes-export";
import type { FileExportResult } from "../ipc-contract";
import { getDb, getDocument } from "./db";
import { chooseExportPath, writeAtomically } from "./export-file";

export async function saveNotes({
  markdown,
  destinationPath,
}: {
  markdown: string;
  destinationPath: string | null;
}): Promise<FileExportResult> {
  if (destinationPath === null) return { status: "cancelled" };
  await writeAtomically(destinationPath, markdown);
  return { status: "exported" };
}

export async function exportNotes(
  documentId: string,
  markdown: string,
): Promise<FileExportResult> {
  const document = await getDocument(getDb(), documentId);
  if (!document) {
    return { status: "failed", message: "This document no longer exists." };
  }

  const destinationPath = await chooseExportPath({
    title: "Export notes",
    defaultPath: notesFilename(document.title),
    buttonLabel: "Export",
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });

  try {
    return await saveNotes({ markdown, destinationPath });
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

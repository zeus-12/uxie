import { readFile, stat } from "fs/promises";
import { dirname } from "path";
import { getDocument as loadPdfJsDocument } from "pdfjs-dist/legacy/build/pdf";
import {
  annotatedPdfFilename,
  createAnnotatedPdf,
  type AnnotatedPdfHighlight,
} from "@uxie/shared/lib/annotated-pdf";
import type { HighlightWithRects } from "@uxie/shared/schema";
import type { FileExportResult } from "../ipc-contract";
import { getDb, getDocument } from "./db";
import { chooseExportPath, writeAtomically } from "./export-file";
import { documentsDir } from "./pdf";
import { pdfPath } from "./pdf-store";

function exportHighlights(
  highlights: HighlightWithRects[],
): AnnotatedPdfHighlight[] {
  return highlights.map((highlight) => ({
    id: highlight.id,
    position: {
      pageNumber: highlight.pageNumber,
      boundingRect: highlight.boundingRectangle,
      rects: highlight.rectangles,
    },
  }));
}

async function isSameDirectory(a: string, b: string): Promise<boolean> {
  const [first, second] = await Promise.all([stat(a), stat(b)]);
  return first.dev === second.dev && first.ino === second.ino;
}

export async function saveAnnotatedPdf({
  highlights,
  sourcePath,
  destinationPath,
}: {
  highlights: HighlightWithRects[];
  sourcePath: string;
  destinationPath: string | null;
}): Promise<FileExportResult> {
  if (destinationPath === null) return { status: "cancelled" };
  if (await isSameDirectory(dirname(destinationPath), dirname(sourcePath))) {
    throw new Error(
      "Choose a folder outside Uxie's library so the stored PDFs stay unchanged.",
    );
  }

  const sourceBytes = await readFile(sourcePath);
  const pdfJsDocument = await loadPdfJsDocument({
    data: new Uint8Array(sourceBytes),
  }).promise;
  let exportedBytes: Uint8Array;
  try {
    exportedBytes = await createAnnotatedPdf(
      sourceBytes,
      exportHighlights(highlights),
      pdfJsDocument,
    );
  } finally {
    await pdfJsDocument.destroy();
  }
  await writeAtomically(destinationPath, exportedBytes);
  return { status: "exported" };
}

export async function exportAnnotatedPdf(
  documentId: string,
): Promise<FileExportResult> {
  const document = await getDocument(getDb(), documentId);
  if (!document) {
    return { status: "failed", message: "This document no longer exists." };
  }

  const sourcePath = pdfPath(documentsDir(), document.id);
  const destinationPath = await chooseExportPath({
    title: "Export annotated PDF",
    defaultPath: annotatedPdfFilename(document.title),
    buttonLabel: "Export",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  try {
    return await saveAnnotatedPdf({
      highlights: document.highlights,
      sourcePath,
      destinationPath,
    });
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

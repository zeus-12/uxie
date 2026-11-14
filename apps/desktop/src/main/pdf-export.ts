import { randomUUID } from "crypto";
import { readFile, rename, rm, writeFile } from "fs/promises";
import { basename, dirname, join, resolve } from "path";
import { dialog } from "electron";
import {
  annotatedPdfFilename,
  createAnnotatedPdf,
  type AnnotatedPdfHighlight,
} from "@uxie/shared/lib/annotated-pdf";
import type { HighlightWithRects } from "@uxie/shared/schema";
import type { AnnotatedPdfExportResult } from "../ipc-contract";
import { getDb, getDocument } from "./db";
import { documentsDir } from "./pdf";
import { pdfPath } from "./pdf-store";

function exportHighlights(
  highlights: HighlightWithRects[],
): AnnotatedPdfHighlight[] {
  return highlights.map((highlight) => ({
    position: {
      pageNumber: highlight.pageNumber,
      boundingRect: highlight.boundingRectangle,
      rects: highlight.rectangles,
    },
  }));
}

async function writeAtomically(
  destinationPath: string,
  bytes: Uint8Array,
): Promise<void> {
  const temporaryPath = join(
    dirname(destinationPath),
    `.${basename(destinationPath)}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, destinationPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function saveAnnotatedPdf({
  highlights,
  sourcePath,
  destinationPath,
}: {
  highlights: HighlightWithRects[];
  sourcePath: string;
  destinationPath: string | null;
}): Promise<AnnotatedPdfExportResult> {
  if (destinationPath === null) return { status: "cancelled" };
  if (resolve(destinationPath) === resolve(sourcePath)) {
    throw new Error(
      "Choose a different location so Uxie's original PDF stays unchanged.",
    );
  }

  const sourceBytes = await readFile(sourcePath);
  const exportedBytes = await createAnnotatedPdf(
    sourceBytes,
    exportHighlights(highlights),
  );
  await writeAtomically(destinationPath, exportedBytes);
  return { status: "exported" };
}

export async function exportAnnotatedPdf(
  documentId: string,
): Promise<AnnotatedPdfExportResult> {
  const document = await getDocument(getDb(), documentId);
  if (!document)
    throw new Error("Open the document again and retry the export.");

  const sourcePath = pdfPath(documentsDir(), document.id);
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Export annotated PDF",
    defaultPath: annotatedPdfFilename(document.title),
    buttonLabel: "Export",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  return saveAnnotatedPdf({
    highlights: document.highlights,
    sourcePath,
    destinationPath: canceled || !filePath ? null : filePath,
  });
}

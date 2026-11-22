import PdfReader from "@/components/pdf-reader/reader";
import { ReaderHeader } from "@/components/workspace/reader-header";
import { addHighlightToNotes } from "@/lib/add-highlight-to-notes";
import { api } from "@/lib/api";
import { useBlocknoteEditorStore } from "@/lib/store";
import { type AddHighlightType, HighlightContentType } from "@/types/highlight";
import type { PdfDocumentData } from "@/types/reader";
import { createId } from "@paralleldrive/cuid2";
import { HighlightTypeEnum } from "@prisma/client";
import { useRouter } from "next/router";

import { toast } from "sonner";

const DocViewer = ({
  canEdit,
  doc,
}: {
  canEdit: boolean;
  doc: PdfDocumentData;
}) => {
  const { query, isReady } = useRouter();

  const docId = query?.docId as string;
  const utils = api.useContext();

  const { mutate: addHighlightMutation } = api.highlight.add.useMutation({
    async onMutate(newHighlight) {
      await utils.document.getDocData.cancel();
      const prevData = utils.document.getDocData.getData();

      utils.document.getDocData.setData({ docId: docId }, (old) => {
        if (!old || old.kind !== "pdf") return old;

        return {
          ...old,
          highlights: [
            ...old.highlights,
            {
              id: newHighlight.id,
              position: {
                boundingRect: {
                  id: `${newHighlight.id}-bounds`,
                  ...newHighlight.boundingRect,
                  pageNumber: newHighlight.boundingRect.pageNumber ?? null,
                },
                rects: newHighlight.rects.map((rect, index) => ({
                  id: `${newHighlight.id}-rect-${index}`,
                  ...rect,
                  pageNumber: rect.pageNumber ?? null,
                })),
                pageNumber: newHighlight.pageNumber,
              },
            },
          ],
        };
      });

      return { prevData };
    },
    onError(err, newPost, ctx) {
      toast.error("Something went wrong", {
        duration: 3000,
      });

      utils.document.getDocData.setData({ docId: docId }, ctx?.prevData);
    },
    onSettled() {
      // Sync with server once mutation has settled
      utils.document.getDocData.invalidate();
    },
  });

  const { mutate: deleteHighlightMutation } = api.highlight.delete.useMutation({
    async onMutate(oldHighlight) {
      await utils.document.getDocData.cancel();
      const prevData = utils.document.getDocData.getData();

      utils.document.getDocData.setData({ docId: docId }, (old) => {
        if (!old || old.kind !== "pdf") return old;
        return {
          ...old,
          highlights: [
            ...old.highlights.filter(
              (highlight) => highlight.id !== oldHighlight.highlightId,
            ),
          ],
        };
      });

      return { prevData };
    },
    onError(err, newPost, ctx) {
      toast.error("Something went wrong", {
        duration: 3000,
      });
      utils.document.getDocData.setData({ docId: docId }, ctx?.prevData);
    },
    onSettled() {
      utils.document.getDocData.invalidate();
    },
  });

  async function addHighlight({ content, position }: AddHighlightType) {
    const highlightId = createId();

    if (!content.text && !content.image) return;
    const isTextHighlight = !content.image;

    // todo check if user has edit/admin access => also dont render the highlight popover for them.

    addHighlightMutation({
      id: highlightId,
      boundingRect: position.boundingRect,
      type: isTextHighlight ? HighlightTypeEnum.TEXT : HighlightTypeEnum.IMAGE,
      documentId: docId,
      pageNumber: position.pageNumber,
      rects: position.rects,
    });

    const editor = useBlocknoteEditorStore.getState().editor;

    if (isTextHighlight) {
      if (!content.text) return;

      // todo why is id being passed here?
      void addHighlightToNotes({
        content: content.text,
        highlightId,
        type: HighlightContentType.TEXT,
        editor,
        canEdit,
        pageNumber: position.pageNumber,
      });
    } else {
      if (!content.image) return;

      void addHighlightToNotes({
        content: content.image,
        highlightId,
        type: HighlightContentType.IMAGE,
        editor,
        canEdit,
      });
    }
  }

  const deleteHighlight = (id: string) => {
    // todo check if user has edit/admin access
    deleteHighlightMutation({
      documentId: docId,
      highlightId: id,
    });
  };

  if (!doc || !doc.highlights || !isReady) {
    return;
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <ReaderHeader title={doc.title} canEdit={canEdit} documentId={docId} />
      <div className="relative h-full w-full">
        <PdfReader
          deleteHighlight={deleteHighlight}
          doc={doc}
          addHighlight={addHighlight}
        />
      </div>
    </div>
  );
};

export default DocViewer;

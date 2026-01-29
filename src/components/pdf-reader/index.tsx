import PdfReader from "@/components/pdf-reader/reader";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useBlocknoteEditorStore } from "@/lib/store";
import { cn, stripTextFromEnd } from "@/lib/utils";
import { AppRouter } from "@/server/api/root";
import { BlockNoteEditorType } from "@/types/editor";
import { AddHighlightType, HighlightContentType } from "@/types/highlight";
import { createId } from "@paralleldrive/cuid2";
import { HighlightTypeEnum } from "@prisma/client";
import { inferRouterOutputs } from "@trpc/server";
import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const addHighlightToNotes = async (
  content: string,
  highlightId: string,
  type: HighlightContentType,
  editor: BlockNoteEditorType | null,
  canEdit: boolean,
) => {
  if (!editor) {
    toast.error("Couldn't add highlight to text, try reloading the page.", {
      duration: 3000,
    });
    return;
  }

  if (!canEdit) {
    toast.error(
      "User doesn't have the required permission to edit the document",
      {
        duration: 3000,
      },
    );
    return;
  }

  if (type === HighlightContentType.TEXT) {
    if (!content || !highlightId) return;

    try {
      editor.insertBlocks(
        [
          {
            type: "highlight",
            content,
            props: {
              highlightId,
            },
          },
        ],
        // cause of noUncheckedIndexedAccess => issue in blocknote
        // @ts-ignore
        editor.document[editor.document.length - 1],
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  } else {
    if (!content || !highlightId || !editor.uploadFile) return;

    const base64StringWithoutHeader = content.split(",")[1];
    if (!base64StringWithoutHeader) {
      toast.error("Invalid image", { duration: 3000 });
      return;
    }

    const byteArray = Uint8Array.from(atob(base64StringWithoutHeader), (c) =>
      c.charCodeAt(0),
    );
    const file = new File([byteArray], `${highlightId}.png`, {
      type: "image/png",
    });

    const url = (await editor.uploadFile(file)) as string;

    try {
      editor.insertBlocks(
        [
          {
            props: {
              url,
            },
            type: "image",
          },
        ],
        // cause of noUncheckedIndexedAccess => issue in blocknote
        // @ts-ignore
        editor.document[editor.document.length - 1],
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  }
};

const DocViewer = ({
  canEdit,
  doc,
}: {
  canEdit: boolean;
  doc: inferRouterOutputs<AppRouter>["document"]["getDocData"];
}) => {
  const { query, isReady } = useRouter();

  const docId = query?.docId as string;
  const utils = api.useContext();

  const { mutate: addHighlightMutation } = api.highlight.add.useMutation({
    async onMutate(newHighlight) {
      await utils.document.getDocData.cancel();
      const prevData = utils.document.getDocData.getData();

      // @ts-ignore
      utils.document.getDocData.setData({ docId: docId }, (old) => {
        if (!old) return null;

        return {
          ...old,
          highlights: [
            ...old.highlights,
            {
              position: {
                boundingRect: newHighlight.boundingRect,
                rects: newHighlight.rects,
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
        if (!old) return undefined;
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

  useEffect(() => {
    const scrollToHighlightFromHash = () => {};

    window.addEventListener("hashchange", scrollToHighlightFromHash, false);

    return () => {
      window.removeEventListener("hashchange", scrollToHighlightFromHash);
    };
  }, []);

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
      addHighlightToNotes(
        content.text,
        highlightId,
        HighlightContentType.TEXT,
        editor,
        canEdit,
      );
    } else {
      if (!content.image) return;

      addHighlightToNotes(
        content.image,
        highlightId,
        HighlightContentType.IMAGE,
        editor,
        canEdit,
      );
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
      <div className="flex items-center">
        <Link
          href="/f"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit justify-start",
          )}
        >
          <ChevronLeftIcon className="mr-2 h-4 w-4" />
        </Link>

        <Title title={doc?.title} canEdit={canEdit} docId={docId} />
      </div>
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

const Title = ({
  canEdit,
  title,
  docId,
}: {
  canEdit: boolean;
  title: string | null;
  docId: string;
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const displayTitle = stripTextFromEnd(title, ".pdf");
  const [titleValue, setTitleValue] = useState(displayTitle);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const utils = api.useContext();

  const { mutate: updateTitleMutation } = api.document.updateTitle.useMutation({
    async onMutate(newData) {
      await utils.document.getDocData.cancel();
      const prevData = utils.document.getDocData.getData({ docId });

      utils.document.getDocData.setData({ docId }, (old) => {
        if (!old) return undefined;
        return {
          ...old,
          title: newData.title,
        };
      });

      return { prevData };
    },
    onError(err, _newData, ctx) {
      toast.error("Failed to update title");
      utils.document.getDocData.setData({ docId }, ctx?.prevData);
    },
    onSettled() {
      utils.document.getDocData.invalidate();
    },
  });

  const handleTitleSave = () => {
    const trimmedTitle = titleValue.trim();
    if (!trimmedTitle) {
      setTitleValue(displayTitle);
      setIsEditingTitle(false);
      return;
    }

    if (trimmedTitle !== displayTitle) {
      updateTitleMutation({ docId, title: trimmedTitle });
    }
    setIsEditingTitle(false);
  };

  useEffect(() => {
    setTitleValue(displayTitle);
  }, [displayTitle]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  return (
    <div className="flex-1 min-w-0">
      {isEditingTitle ? (
        <input
          ref={titleInputRef}
          type="text"
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleTitleSave();
            } else if (e.key === "Escape") {
              setTitleValue(displayTitle);
              setIsEditingTitle(false);
            }
          }}
          className="w-full font-semibold bg-transparent border-none outline-none focus:ring-0 px-1 -mx-1 leading-normal"
        />
      ) : (
        <p
          className={cn(
            "line-clamp-1 font-semibold leading-normal px-1 -mx-1 rounded",
            canEdit && "cursor-pointer hover:bg-muted/50",
          )}
          onClick={() => canEdit && setIsEditingTitle(true)}
          title={canEdit ? "Click to edit" : undefined}
        >
          {displayTitle}
        </p>
      )}
    </div>
  );
};

export default DocViewer;

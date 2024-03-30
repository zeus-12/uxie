import PdfReader from "@/components/pdf-reader/pdf-reader";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { useBlocknoteEditorStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AppRouter } from "@/server/api/root";
import { HighlightContentType, HighlightPositionType } from "@/types/highlight";
import { insertOrUpdateBlock } from "@blocknote/core";
import { createId } from "@paralleldrive/cuid2";
import { HighlightTypeEnum } from "@prisma/client";
import { inferRouterOutputs } from "@trpc/server";
import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";

type RouterOutput = inferRouterOutputs<AppRouter>;
type HighlightType =
  RouterOutput["document"]["getDocData"]["highlights"][number];

interface AddHighlighType {
  content: {
    text?: string;
    image?: string;
  };
  position: HighlightPositionType;
}

const DocViewer = ({
  canEdit,
  doc,
}: {
  canEdit: boolean;
  doc: inferRouterOutputs<AppRouter>["document"]["getDocData"];
}) => {
  const { query, isReady } = useRouter();

  const docId = query?.docId;

  const { mutate: addHighlightMutation } = api.highlight.add.useMutation({
    async onMutate(newHighlight) {
      await utils.document.getDocData.cancel();
      const prevData = utils.document.getDocData.getData();

      // @ts-ignore
      utils.document.getDocData.setData({ docId: docId as string }, (old) => {
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
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
        duration: 3000,
      });

      utils.document.getDocData.setData(
        { docId: docId as string },
        ctx?.prevData,
      );
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

      utils.document.getDocData.setData({ docId: docId as string }, (old) => {
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
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
        duration: 3000,
      });
      utils.document.getDocData.setData(
        { docId: docId as string },
        ctx?.prevData,
      );
    },
    onSettled() {
      utils.document.getDocData.invalidate();
    },
  });

  const { editor } = useBlocknoteEditorStore();

  const addHighlightToNotes = (
    content: string,
    highlightId: string,
    type: HighlightContentType,
  ) => {
    if (!editor) {
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (!canEdit) {
      toast({
        title: "Error",
        description: "User can't edit this document",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (type === HighlightContentType.TEXT) {
      if (!content || !highlightId) return;

      insertOrUpdateBlock(editor, {
        content,
        props: {
          highlightId,
        },
        type: "highlight",
      });
    } else {
      if (!content || !highlightId) return;

      try {
        insertOrUpdateBlock(editor, {
          props: {
            url: content,
          },
          type: "image",
        });
      } catch (err: any) {
        console.log(err.message, "errnes");
      }
    }
  };

  const utils = api.useContext();

  useEffect(() => {
    const scrollToHighlightFromHash = () => {};

    window.addEventListener("hashchange", scrollToHighlightFromHash, false);

    return () => {
      window.removeEventListener("hashchange", scrollToHighlightFromHash);
    };
  }, []);

  function getHighlightById(id: string): HighlightType | undefined {
    return doc?.highlights?.find((highlight) => highlight.id === id);
  }

  async function addHighlight({ content, position }: AddHighlighType) {
    const highlightId = createId();

    if (!content.text && !content.image) return;
    const isTextHighlight = !content.image;

    // todo check if user has edit/admin access

    addHighlightMutation({
      id: highlightId,
      boundingRect: position.boundingRect,
      type: isTextHighlight ? HighlightTypeEnum.TEXT : HighlightTypeEnum.IMAGE,
      documentId: docId as string,
      pageNumber: position.pageNumber,
      rects: position.rects,
    });

    if (isTextHighlight) {
      if (!content.text) return;

      // todo why is id being passed here?
      addHighlightToNotes(content.text, highlightId, HighlightContentType.TEXT);
    } else {
      if (!content.image) return;

      addHighlightToNotes(
        content.image,
        highlightId,
        HighlightContentType.IMAGE,
      );
    }
  }

  const deleteHighlight = (id: string) => {
    // todo check if user has edit/admin access
    deleteHighlightMutation({
      documentId: docId as string,
      highlightId: id,
    });
  };

  // if (isError) {
  //   return <>error</>;
  // }

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

        <p className="line-clamp-1 font-semibold">{doc?.title ?? docId}</p>
      </div>
      <div className="relative h-full w-full">
        <PdfReader
          docId={docId as string}
          deleteHighlight={deleteHighlight}
          docUrl={doc.url}
          getHighlightById={getHighlightById}
          addHighlight={addHighlight}
          highlights={doc.highlights ?? []}
        />
      </div>
    </div>
  );
};

export default DocViewer;

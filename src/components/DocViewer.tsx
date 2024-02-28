import { useEffect } from "react";
import { GhostHighlight, Highlight } from "react-pdf-highlighter-extended";
import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useRouter } from "next/router";
import { HighlightContentType, CompactHighlight } from "@/types/highlight";
import { buttonVariants } from "@/components/ui/button";
import { cn, copyTextToClipboard } from "@/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import { useBlocknoteEditorStore } from "@/lib/store";
import { HighlightTypeEnum } from "@prisma/client";
import { toast } from "@/components/ui/use-toast";
import { AppRouter } from "@/server/api/root";
import { inferRouterOutputs } from "@trpc/server";
import PdfReader from "@/components/PdfReader";

const parseIdFromHash = () => document.location.hash.slice(1);

type RouterOutput = inferRouterOutputs<AppRouter>;
type HighlightType =
  RouterOutput["document"]["getDocData"]["highlights"][number];

interface AddHighlightType {
  content: {
    text?: string;
    image?: string;
  };
  position: CompactHighlight;
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

      const block = editor.getTextCursorPosition().block;
      // hack
      const blockIsEmpty = (block.content as any[])?.length === 0;

      if (blockIsEmpty) {
        editor.updateBlock(block, {
          content: content,
          props: {
            highlightId: highlightId,
          },
          type: "highlight",
        });
      } else {
        editor.insertBlocks(
          [
            {
              content: content,
              props: {
                highlightId: highlightId,
              },
              type: "highlight",
            },
          ],
          editor.getTextCursorPosition().block,
          "after",
        );
        editor.setTextCursorPosition(editor.getTextCursorPosition().nextBlock!);
      }
    } else {
      if (!content || !highlightId) return;

      try {
        const block = editor.getTextCursorPosition().block;
        const blockIsEmpty = (block.content as any[])?.length === 0;

        if (blockIsEmpty) {
          editor.updateBlock(block, {
            props: {
              url: content,
            },
            type: "image",
          });
        } else {
          editor.insertBlocks(
            [
              {
                props: {
                  url: content,
                },
                type: "image",
              },
            ],
            editor.getTextCursorPosition().block,
            "after",
          );
          editor.setTextCursorPosition(
            editor.getTextCursorPosition().nextBlock!,
          );
        }
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

  async function addHighlight({ content, position }: GhostHighlight) {
    const highlightId = createId();

    if (!content.text && !content.image) return;
    const isTextHighlight = !content.image;

    // todo check if user has edit/admin access

    addHighlightMutation({
      id: highlightId,
      boundingRect: position.boundingRect,
      type: isTextHighlight ? HighlightTypeEnum.TEXT : HighlightTypeEnum.IMAGE,
      documentId: docId as string,
      pageNumber: position.boundingRect.pageNumber,
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
          docUrl={doc.url}
          getHighlightById={getHighlightById}
          addHighlight={addHighlight}
          // @ts-ignore
          highlights={doc.highlights ?? []}
        />
      </div>
    </div>
  );
};

export default DocViewer;

// const PdfReader = ({
// docUrl,
// getHighlightById,
// addHighlight,
// deleteHighlight,
// highlights,
// docId,
// }: {
//   docId: string;
//   docUrl: string;
//   getHighlightById: (id: string) => HighlightType | undefined;
//   addHighlight: ({ content, position }: AddHighlightType) => Promise<void>;
//   deleteHighlight: (id: string) => void;
//   highlights: HighlightType[];
// }) => {
//   const utils = api.useContext();

//   const { mutate: updateAreaHighlightMutation } =
//     api.highlight.updateAreaHighlight.useMutation({
//       async onMutate(newHighlight) {
//         await utils.document.getDocData.cancel();
//         const prevData = utils.document.getDocData.getData();
//         //@ts-ignore
//         utils.document.getDocData.setData({ docId: docId as string }, (old) => {
//           if (!old) return undefined;
//           return {
//             ...old,
//             highlights: [
//               ...old.highlights.filter(
//                 (highlight) => highlight.id !== newHighlight.id,
//               ),
//               {
//                 position: {
//                   boundingRect: newHighlight.boundingRect,
//                   pageNumber: newHighlight.pageNumber,
//                   rects: [],
//                 },
//               },
//             ],
//           };
//         });
//         return { prevData };
//       },
//       onError(err, newPost, ctx) {
//         toast({
//           title: "Error",
//           description: "Something went wrong",
//           variant: "destructive",
//           duration: 3000,
//         });
//         utils.document.getDocData.setData(
//           { docId: docId as string },
//           ctx?.prevData,
//         );
//       },
//       onSettled() {
//         utils.document.getDocData.invalidate();
//       },
//     });

//   return (
//     <PdfReaderApp />

// <PdfLoader url={docUrl} beforeLoad={<SpinnerPage />}>
//   {(pdfDocument) => (
//     <PdfHighlighter
//       pdfDocument={pdfDocument}
//       enableAreaSelection={(event) => event.altKey}
//       onScrollChange={resetHash}
//       // pdfScaleValue="page-width"
//       scrollRef={(scrollTo) => {
//         scrollViewerTo = scrollTo;
//         scrollToHighlightFromHash();
//       }}
//       onSelectionFinished={(
//         position,
//         content,
//         hideTipAndSelection,
//         transformSelection,
//       ) => {
//         return (
//           <TextSelectionPopover
//             content={content}
//             hideTipAndSelection={hideTipAndSelection}
//             position={position}
//             addHighlight={() => addHighlight({ content, position })}
//           />
//         );
//       }}
//       highlightTransform={(
//         highlight,
//         index,
//         setTip,
//         hideTip,
//         viewportToScaled,
//         screenshot,
//         isScrolledTo,
//       ) => {
//         const isTextHighlight = highlight.position.rects?.length !== 0;

// const component = isTextHighlight ? (
//   <div id={highlight.id}>
//     {/* @ts-ignore */}
//     <Highlight
//       isScrolledTo={isScrolledTo}
//       position={highlight.position}
//     />
//   </div>
// ) : (
//   <div id={highlight.id}>
//     <AreaHighlight
//       isScrolledTo={isScrolledTo}
//       highlight={highlight}
//       onChange={(boundingRect) => {
//         updateAreaHighlightMutation({
//           id: highlight.id,
//           boundingRect: viewportToScaled(boundingRect),
//           type: HighlightTypeEnum.IMAGE,
//           documentId: docId as string,
//           ...(boundingRect.pageNumber
//             ? { pageNumber: boundingRect.pageNumber }
//             : {}),
//         });
//       }}
//     />
//   </div>
// );

//         return (
//           <Popup
//             popupContent={
//               <HighlightedTextPopup
//                 id={highlight.id}
//                 deleteHighlight={deleteHighlight}
//                 hideTip={hideTip}
//               />
//             }
//             onMouseOver={(popupContent) =>
//               setTip(highlight, (highlight) => popupContent)
//             }
//             onMouseOut={hideTip}
//             key={index}
//           >
//             {component}
//           </Popup>
//         );
//       }}
//       // @ts-ignore
//       highlights={highlights}
//     />
//   )}
// </PdfLoader>
//   );
// };

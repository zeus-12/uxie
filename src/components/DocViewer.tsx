import { useEffect } from "react";
import {
  PdfLoader,
  PdfHighlighter,
  Highlight,
  Popup,
  AreaHighlight,
} from "react-pdf-highlighter";
import { Spinner } from "@/components/Spinner";
import { ClipboardCopy, Highlighter, TrashIcon } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useRouter } from "next/router";
import { HighlightContentType, HighlightPositionType } from "@/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon } from "@/components/icons";
import { createId } from "@paralleldrive/cuid2";
import { useBlocknoteEditorStore } from "@/lib/store";
import { HighlightTypeEnum } from "@prisma/client";

const parseIdFromHash = () => document.location.hash.slice(1);

const resetHash = () => {
  document.location.hash = "";
};

const DocViewer = () => {
  const { query, isReady } = useRouter();

  const docId = query?.docId;

  const {
    data: doc,
    isLoading,
    isError,
  } = api.document.getDocData.useQuery(
    {
      docId: docId as string,
    },
    {
      enabled: !!docId,
    },
  );

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
        if (!old) return null;
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
      console.log("editor null");
      return;
    }

    if (type === HighlightContentType.TEXT) {
      if (!content || !highlightId) return;

      const block = editor.getTextCursorPosition().block;
      const blockIsEmpty = block.content?.length === 0;

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
        const blockIsEmpty = block.content?.length === 0;

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

  let scrollViewerTo = (highlight: any) => {};

  const scrollToHighlightFromHash = () => {
    const highlight = getHighlightById(parseIdFromHash());

    if (highlight) {
      scrollViewerTo(highlight);
    }
  };

  useEffect(() => {
    const scrollToHighlightFromHash = () => {};

    window.addEventListener("hashchange", scrollToHighlightFromHash, false);

    return () => {
      window.removeEventListener("hashchange", scrollToHighlightFromHash);
    };
  }, []);

  function getHighlightById(id: string) {
    return doc?.highlights?.find((highlight) => highlight.id === id);
  }

  async function addHighlight({
    content,
    position,
  }: {
    content: {
      text?: string;
      image?: string;
    };
    position: HighlightPositionType;
  }) {
    const highlightId = createId();

    if (!content.text && !content.image) return;
    const isTextHighlight = !content.image;

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
    deleteHighlightMutation({
      documentId: docId as string,
      highlightId: id,
    });
  };

  if (isError) {
    return <>error</>;
  }

  if (!doc || !doc.highlights || !isReady) {
    return;
  }

  return (
    <div className="flex h-screen flex-col">
      <div className=" flex items-center justify-between">
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

          <p className="font-semibold">{doc?.title ?? docId}</p>
        </div>
      </div>
      <div className="relative h-screen w-full ">
        <PdfLoader
          url={doc.url}
          beforeLoad={
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          }
        >
          {(pdfDocument) => (
            <PdfHighlighter
              pdfDocument={pdfDocument}
              enableAreaSelection={(event) => event.altKey}
              onScrollChange={resetHash}
              // pdfScaleValue="page-width"
              scrollRef={(scrollTo) => {
                scrollViewerTo = scrollTo;
                scrollToHighlightFromHash();
              }}
              onSelectionFinished={(
                position,
                content,
                hideTipAndSelection,
                transformSelection,
              ) => {
                return (
                  <TextSelectionPopover
                    content={content}
                    hideTipAndSelection={hideTipAndSelection}
                    position={position}
                    addHighlight={() => addHighlight({ content, position })}
                  />
                );
              }}
              highlightTransform={(
                highlight,
                index,
                setTip,
                hideTip,
                viewportToScaled,
                screenshot,
                isScrolledTo,
              ) => {
                const isTextHighlight = highlight.position.rects.length !== 0;

                const component = isTextHighlight ? (
                  <div id={highlight.id}>
                    {/* @ts-ignore */}
                    <Highlight
                      isScrolledTo={isScrolledTo}
                      position={highlight.position}
                    />
                  </div>
                ) : (
                  <div id={highlight.id}>
                    <AreaHighlight
                      isScrolledTo={isScrolledTo}
                      highlight={highlight}
                      onChange={() => {}}
                    />
                  </div>
                );

                return (
                  <Popup
                    popupContent={
                      <HighlightedTextPopup
                        id={highlight.id}
                        deleteHighlight={deleteHighlight}
                        hideTip={hideTip}
                      />
                    }
                    onMouseOver={(popupContent) =>
                      setTip(highlight, (highlight) => popupContent)
                    }
                    onMouseOut={hideTip}
                    key={index}
                  >
                    {component}
                  </Popup>
                );
              }}
              // @ts-ignore => since i removed comments from highlight
              highlights={doc?.highlights ?? []}
            />
          )}
        </PdfLoader>
      </div>
    </div>
  );
};

export default DocViewer;

const TextSelectionPopover = ({
  content,
  hideTipAndSelection,
  position,
  addHighlight,
}: {
  position: any;
  addHighlight: () => void;
  content: {
    text?: string | undefined;
    image?: string | undefined;
  };
  hideTipAndSelection: () => void;
}) => {
  const copyTextToClipboard = () => {
    // check how to copy image to clipboard
    if (content.text) {
      navigator.clipboard.writeText(content.text);
    }
    hideTipAndSelection();
  };

  return (
    <div className="flex rounded-md bg-black">
      <div
        className="p-2 hover:cursor-pointer"
        onClick={() => {
          addHighlight();
          hideTipAndSelection();
        }}
      >
        <Highlighter size={18} className="rounded-full  text-gray-200 " />
      </div>
      <div className="p-2 hover:cursor-pointer" onClick={copyTextToClipboard}>
        <ClipboardCopy size={18} className="rounded-full text-gray-200" />
      </div>
    </div>
  );
};

const HighlightedTextPopup = ({
  id,
  deleteHighlight,
  hideTip,
}: {
  id: string;
  deleteHighlight: any;
  hideTip: () => void;
}) => {
  return (
    <div className="flex rounded-md bg-black">
      <div
        className="p-2 hover:cursor-pointer"
        onClick={() => {
          deleteHighlight(id);
          hideTip();
        }}
      >
        <TrashIcon
          size={18}
          className="rounded-full text-gray-200 hover:cursor-pointer"
        />
      </div>
    </div>
  );
};

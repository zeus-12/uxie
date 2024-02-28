import React, { MouseEvent, useEffect, useRef, useState } from "react";
import ContextMenu, { ContextMenuProps } from "./ContextMenu";
import ExpandableTip from "./ExpandableTip";
import HighlightContainer from "./HighlightContainer";
import Toolbar from "./Toolbar";
import {
  GhostHighlight,
  PdfHighlighter,
  PdfHighlighterUtils,
  PdfLoader,
  ViewportHighlight,
} from "react-pdf-highlighter-extended";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { CompactHighlight } from "@/types/highlight";
import { inferRouterOutputs } from "@trpc/server";
import { AppRouter } from "@/server/api/root";

const parseIdFromHash = () => {
  return document.location.hash.slice("#highlight-".length);
};

const resetHash = () => {
  document.location.hash = "";
};

type RouterOutput = inferRouterOutputs<AppRouter>;
type HighlightType =
  RouterOutput["document"]["getDocData"]["highlights"][number];

const PdfReader = ({
  docUrl,
  getHighlightById,
  addHighlight,
  // deleteHighlight,
  highlights,
  docId,
}: {
  docUrl: string;
  getHighlightById: (id: string) => HighlightType | undefined;
  addHighlight: ({ content, position }: GhostHighlight) => void;
  // deleteHighlight: (id: string) => void;
  highlights: CompactHighlight[];
  docId: string;
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
  const [pdfScaleValue, setPdfScaleValue] = useState<number | undefined>(
    undefined,
  );

  // Refs for PdfHighlighter utilities
  const highlighterUtilsRef = useRef<PdfHighlighterUtils>();

  // Click listeners for context menu
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [contextMenu]);

  const handleContextMenu = (
    event: MouseEvent<HTMLDivElement>,
    highlight: ViewportHighlight,
  ) => {
    event.preventDefault();

    setContextMenu({
      xPos: event.clientX,
      yPos: event.clientY,

      // deleteHighlight: () => deleteHighlight(highlight.id),
      // editComment: () => editComment(highlight),
    });
  };

  // const editHighlight = (
  //   idToUpdate: string,
  //   edit: Partial<CommentedHighlight>,
  // ) => {
  //   console.log(`Editing highlight ${idToUpdate} with `, edit);
  //   setHighlights(
  //     highlights.map((highlight) =>
  //       highlight.id === idToUpdate ? { ...highlight, ...edit } : highlight,
  //     ),
  //   );
  // };

  // const getHighlightById = (id: string) => {
  //   return highlights.find((highlight) => highlight.id === id);
  // };

  // Scroll to highlight based on hash in the URL
  const scrollToHighlightFromHash = () => {
    const highlight = getHighlightById(parseIdFromHash());

    if (highlight && highlighterUtilsRef.current) {
      // @ts-ignore
      highlighterUtilsRef.current.scrollToHighlight(highlight);
    }
  };

  const utils = api.useContext();

  const { mutate: updateAreaHighlight } =
    api.highlight.updateAreaHighlight.useMutation({
      async onMutate(newHighlight) {
        await utils.document.getDocData.cancel();
        const prevData = utils.document.getDocData.getData();
        //@ts-ignore
        utils.document.getDocData.setData({ docId: docId as string }, (old) => {
          if (!old) return undefined;
          return {
            ...old,
            highlights: [
              ...old.highlights.filter(
                (highlight) => highlight.id !== newHighlight.id,
              ),
              {
                position: {
                  boundingRect: newHighlight.boundingRect,
                  pageNumber: newHighlight.pageNumber,
                  rects: [],
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
        utils.document.getDocData.invalidate();
      },
    });

  const { mutate: deleteHighlight } = api.highlight.delete.useMutation({
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

  // Hash listeners for autoscrolling to highlights
  useEffect(() => {
    window.addEventListener("hashchange", scrollToHighlightFromHash);

    return () => {
      window.removeEventListener("hashchange", scrollToHighlightFromHash);
    };
  }, [scrollToHighlightFromHash]);

  return (
    <div className="flex h-screen">
      <div
        style={{
          height: "100vh",
          width: "75vw",
          overflow: "hidden",
          position: "relative",
          flexGrow: 1,
        }}
      >
        <Toolbar setPdfScaleValue={(value) => setPdfScaleValue(value)} />
        <PdfLoader document={docUrl}>
          {(pdfDocument) => (
            <PdfHighlighter
              enableAreaSelection={(event) => event.altKey}
              pdfDocument={pdfDocument}
              onScrollAway={resetHash}
              utilsRef={(_pdfHighlighterUtils) => {
                highlighterUtilsRef.current = _pdfHighlighterUtils;
              }}
              pdfScaleValue={pdfScaleValue}
              selectionTip={<ExpandableTip addHighlight={addHighlight} />}
              // @ts-ignore
              highlights={highlights}
              style={{
                height: "calc(100% - 41px)",
              }}
            >
              <HighlightContainer
                updateAreaHighlight={updateAreaHighlight}
                deleteHighlight={deleteHighlight}
                docId={docId}
                onContextMenu={handleContextMenu}
              />
            </PdfHighlighter>
          )}
        </PdfLoader>
      </div>

      {contextMenu && <ContextMenu {...contextMenu} />}
    </div>
  );
};

export default PdfReader;

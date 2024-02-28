import { MouseEvent } from "react";
import HighlightPopup from "./HighlightPopup";
import {
  AreaHighlight,
  MonitoredHighlightContainer,
  TextHighlight,
  Tip,
  ViewportHighlight,
  useHighlightContainerContext,
  usePdfHighlighterContext,
  Highlight,
} from "react-pdf-highlighter-extended";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { HighlightTypeEnum } from "@prisma/client";

interface HighlightContainerProps {
  onContextMenu?: (
    event: MouseEvent<HTMLDivElement>,
    highlight: ViewportHighlight,
  ) => void;
  docId: string;
  updateAreaHighlight: any;
  deleteHighlight: any;
}

const HighlightContainer = ({
  onContextMenu,
  docId,
  updateAreaHighlight,
  deleteHighlight,
}: HighlightContainerProps) => {
  const {
    highlight,
    viewportToScaled,
    screenshot,
    isScrolledTo,
    highlightBindings,
  } = useHighlightContainerContext<Highlight>();
  const utils = api.useContext();

  // const deleteHighlight = (id: string) => {
  //   // todo check if user has edit/admin access
  //   deleteHighlightMutation({
  //     documentId: docId as string,
  //     highlightId: id,
  //   });
  // };
  const { toggleEditInProgress } = usePdfHighlighterContext();

  const isTextHighlight = !Boolean(
    highlight.content && highlight.content.image,
  );

  const component = isTextHighlight ? (
    <TextHighlight
      isScrolledTo={isScrolledTo}
      highlight={highlight}
      onContextMenu={(event) =>
        onContextMenu && onContextMenu(event, highlight)
      }
    />
  ) : (
    <AreaHighlight
      isScrolledTo={isScrolledTo}
      highlight={highlight}
      onChange={(boundingRect) => {
        updateAreaHighlight({
          id: highlight.id,
          boundingRect: viewportToScaled(boundingRect),
          type: HighlightTypeEnum.IMAGE,
          documentId: docId as string,
          ...(boundingRect.pageNumber
            ? { pageNumber: boundingRect.pageNumber }
            : {}),
        });
        toggleEditInProgress(false);
      }}
      bounds={highlightBindings.textLayer}
      onContextMenu={(event) =>
        onContextMenu && onContextMenu(event, highlight)
      }
      onEditStart={() => toggleEditInProgress(true)}
    />
  );

  const highlightTip: Tip = {
    position: highlight.position,
    content: (
      <HighlightPopup
        id={highlight.id}
        deleteHighlight={() => deleteHighlight(docId, highlight.id)}
        // hideTip={hideTip}
      />
    ),
  };

  return (
    <MonitoredHighlightContainer highlightTip={highlightTip} key={highlight.id}>
      {component}
    </MonitoredHighlightContainer>
  );
};

export default HighlightContainer;

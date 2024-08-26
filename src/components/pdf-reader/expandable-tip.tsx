import { useLayoutEffect, useState } from "react";
import { usePdfHighlighterContext } from "react-pdf-highlighter-extended";

const MyExpandableTip = () => {
  const [compact, setCompact] = useState(true);

  const { getCurrentSelection, updateTipPosition } = usePdfHighlighterContext();

  useLayoutEffect(() => {
    updateTipPosition!();
  }, [compact]);

  return (
    <div className="Tip">
      {compact ? (
        <button
          onClick={() => {
            setCompact(false);
            if (getCurrentSelection()) {
              getCurrentSelection()?.makeGhostHighlight();
            }
          }}
        >
          Expand Tip
        </button>
      ) : (
        <div style={{ padding: "50px" }}>Expanded content</div>
      )}
    </div>
  );
};

export default MyExpandableTip;

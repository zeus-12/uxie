import MouseMonitor from "react-pdf-highlighter/dist/esm/components/MouseMonitor";
import { useEffect, useRef, type MutableRefObject, type ReactElement, type ReactNode } from "react";

type PinnedRef = MutableRefObject<string | null>;

// Ends a pinned tip on any pointerdown outside it (another highlight included) and
// releases the pin however the tip goes away: Escape, delete or the library's own hide.
const PinnedTip = ({
  id,
  pinnedRef,
  hide,
  children,
}: {
  id: string;
  pinnedRef: PinnedRef;
  hide: () => void;
  children: ReactElement;
}) => {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(".PdfHighlighter__tip-container")) return;
      hide();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      if (pinnedRef.current === id) pinnedRef.current = null;
    };
  }, [id, pinnedRef, hide]);
  return children;
};

// Hover shows the tip while the pointer stays near it; a click or tap pins it.
export const HighlightTip = ({
  id,
  pinnedRef,
  show,
  hide,
  popover,
  children,
}: {
  id: string;
  pinnedRef: PinnedRef;
  show: (tip: ReactElement) => void;
  hide: () => void;
  popover: ReactElement;
  children: ReactNode;
}) => {
  const pointerIn = useRef(false);
  return (
    <div
      onMouseOver={() => {
        pointerIn.current = true;
        if (pinnedRef.current) return;
        show(
          <MouseMonitor
            onMoveAway={() => {
              if (!pointerIn.current && !pinnedRef.current) hide();
            }}
            paddingX={60}
            paddingY={30}
          >
            {popover}
          </MouseMonitor>,
        );
      }}
      onMouseOut={() => {
        pointerIn.current = false;
      }}
      onClick={() => {
        pinnedRef.current = id;
        show(
          <PinnedTip id={id} pinnedRef={pinnedRef} hide={hide}>
            {popover}
          </PinnedTip>,
        );
      }}
    >
      {children}
    </div>
  );
};

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  aboveBottomOverlays,
  placePopover,
  scrollBounds,
  type AnchorSource,
  type PopoverAnchor,
} from "../../lib/popover-placement";
import { cn } from "../../lib/utils";

const ARROW_FILL = "M0 0H20V0.5C16 0.5 14 2.5 12.2 5.6Q10 9 7.8 5.6C6 2.5 4 0.5 0 0.5Z";
const ARROW_EDGE = "M0 0.5C4 0.5 6 2.5 7.8 5.6Q10 9 12.2 5.6C14 2.5 16 0.5 20 0.5";

type Props = HTMLAttributes<HTMLDivElement> & {
  anchor: AnchorSource;
  children: ReactNode;
};

export const AnchoredPopover = forwardRef<HTMLDivElement, Props>(
  ({ anchor, children, className, ...rest }, ref) => {
    const node = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => node.current!, []);
    const anchorRef = useRef(anchor);
    anchorRef.current = anchor;
    const lastAnchor = useRef<PopoverAnchor | null>(null);

    const layout = useCallback(() => {
      const el = node.current;
      if (!el) return;
      const geometry = anchorRef.current() ?? lastAnchor.current;
      if (!geometry) return;
      lastAnchor.current = geometry;
      const overlays = [...el.ownerDocument.querySelectorAll("[data-reader-overlay]")].map(
        (overlay) => overlay.getBoundingClientRect(),
      );
      const placement = placePopover(
        geometry,
        { width: el.offsetWidth, height: el.offsetHeight },
        aboveBottomOverlays(scrollBounds(el), overlays),
      );
      const parent = el.offsetParent;
      const origin = parent?.getBoundingClientRect();
      const offsetX = origin ? origin.left + parent!.clientLeft - parent!.scrollLeft : 0;
      const offsetY = origin ? origin.top + parent!.clientTop - parent!.scrollTop : 0;
      el.style.left = `${placement.left - offsetX}px`;
      el.style.top = `${placement.top - offsetY}px`;
      el.style.setProperty("--uxie-popover-arrow-x", `${placement.arrowX}px`);
      el.dataset.side = placement.side;
    }, []);

    useLayoutEffect(layout, [anchor, layout]);

    useEffect(() => {
      const el = node.current;
      if (!el) return;
      const observer = new ResizeObserver(layout);
      observer.observe(el);
      window.addEventListener("resize", layout);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", layout);
      };
    }, [layout]);

    return (
      <div ref={node} className={cn("uxie-popover", className)} {...rest}>
        {children}
        <svg className="uxie-popover-arrow" viewBox="0 0 20 9" aria-hidden="true">
          <path className="uxie-popover-arrow-fill" d={ARROW_FILL} />
          <path className="uxie-popover-arrow-edge" d={ARROW_EDGE} />
        </svg>
      </div>
    );
  },
);
AnchoredPopover.displayName = "AnchoredPopover";

import { describe, expect, it } from "vitest";
import {
  aboveBottomOverlays,
  placePopover,
  type PopoverAnchor,
} from "../lib/popover-placement";

const viewport = { top: 0, left: 0, right: 1000, bottom: 800 };
const size = { width: 200, height: 42 };

const anchorAt = (x: number, lineTop: number, blockTop = lineTop): PopoverAnchor => ({
  x,
  line: { top: lineTop, bottom: lineTop + 18 },
  block: { top: blockTop, bottom: lineTop + 18 },
});

describe("placePopover", () => {
  it("sits 8px plus the pointer under the end line, centred on the anchor", () => {
    const placement = placePopover(anchorAt(500, 300), size, viewport);
    expect(placement).toEqual({ side: "bottom", top: 318 + 16, left: 400, arrowX: 100 });
  });

  it("flips above the whole selection only when there is no room below", () => {
    const placement = placePopover(anchorAt(500, 760, 700), size, viewport);
    expect(placement.side).toBe("top");
    expect(placement.top).toBe(700 - 16 - size.height);
  });

  it("stays below when neither side fits", () => {
    const tight = { ...viewport, bottom: 80 };
    expect(placePopover(anchorAt(500, 20), size, tight).side).toBe("bottom");
  });

  it("flips at the edge of the scroll container, not the window", () => {
    const container = { top: 100, left: 0, right: 1000, bottom: 400 };
    expect(placePopover(anchorAt(500, 350, 340), size, container).side).toBe("top");
  });

  it("shifts inside the bounds with an 8px margin while the pointer stays on the anchor", () => {
    const left = placePopover(anchorAt(30, 300), size, viewport);
    expect(left.left).toBe(8);
    expect(left.left + left.arrowX).toBe(30);

    const right = placePopover(anchorAt(970, 300), size, viewport);
    expect(right.left).toBe(1000 - 8 - 200);
    expect(right.left + right.arrowX).toBe(970);
  });

  it("keeps the pointer clear of the rounded corners at the very edge", () => {
    const placement = placePopover(anchorAt(2, 300), size, viewport);
    expect(placement.left).toBe(8);
    expect(placement.arrowX).toBe(19);
  });

  it("aligns to the leading edge when the bar is wider than the bounds", () => {
    const narrow = { top: 0, left: 0, right: 150, bottom: 800 };
    expect(placePopover(anchorAt(75, 300), size, narrow).left).toBe(8);
  });
});

describe("aboveBottomOverlays", () => {
  const toolbar = new DOMRect(185, 740, 345, 45);

  it("ends the bounds at the top of a toolbar floating over the bottom of the reader", () => {
    expect(aboveBottomOverlays(viewport, [toolbar]).bottom).toBe(740);
  });

  it("ignores overlays in the top half and hidden ones", () => {
    const header = new DOMRect(0, 10, 1000, 40);
    const hidden = new DOMRect(0, 700, 0, 0);
    expect(aboveBottomOverlays(viewport, [header, hidden])).toEqual(viewport);
  });

  it("flips a bar that would land on the toolbar", () => {
    const bounds = aboveBottomOverlays(viewport, [toolbar]);
    expect(placePopover(anchorAt(300, 700, 700), size, bounds).side).toBe("top");
  });
});

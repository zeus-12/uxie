import type { BlockNoteEditor } from "@blocknote/core";
import { useCallback, useEffect, useRef } from "react";

// BlockNote 0.17 picks the hovered block from the pointer's Y alone (it probes
// the horizontal middle of the editor), so the side menu also shows while the
// pointer is over whatever sits next to the notes. Hide it whenever the pointer
// leaves the editor's DOM subtree — the menu itself lives inside that subtree
// even when it visually overhangs the editor's left edge, so containment is the
// test, not the bounding box.
//
// This drives the plugin rather than skipping the render: the side menu is
// positioned by floating-ui without autoUpdate, so rendering nothing leaves it
// measured at zero width and it comes back on top of the text.
export function useSideMenuGate(
  editor: BlockNoteEditor<any, any, any> | undefined,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragHandleMenuOpen = useRef(false);

  useEffect(() => {
    if (!editor) return;

    const sideMenu = editor.sideMenu;
    // unfreezeMenu() throws until the menu has emitted its first state.
    let everShown = false;
    let inside = true;

    const stopWatching = sideMenu.onUpdate((state) => {
      everShown = everShown || state.show;
    });

    const onMouseMove = (e: MouseEvent) => {
      if (dragHandleMenuOpen.current || !everShown) return;
      const container = containerRef.current;
      if (!container) return;

      const target = e.target;
      const nowInside = target instanceof Node && container.contains(target);
      if (nowInside === inside) return;
      inside = nowInside;

      // unfreezeMenu() is the only public way to hide the menu; freezing after
      // it keeps the plugin from resolving a block on every move outside.
      sideMenu.unfreezeMenu();
      if (!nowInside) sideMenu.freezeMenu();
    };

    document.addEventListener("mousemove", onMouseMove, true);
    return () => {
      document.removeEventListener("mousemove", onMouseMove, true);
      stopWatching();
    };
  }, [editor]);

  // An open drag-handle menu pins the side menu to its block, so the pointer is
  // free to wander off the editor until it closes.
  const onDragHandleMenuOpen = useCallback(() => {
    dragHandleMenuOpen.current = true;
  }, []);
  const onDragHandleMenuClose = useCallback(() => {
    dragHandleMenuOpen.current = false;
  }, []);

  return { containerRef, onDragHandleMenuOpen, onDragHandleMenuClose };
}

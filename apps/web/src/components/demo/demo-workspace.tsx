import DemoBanner from "@/components/demo/demo-banner";
import DemoDocViewer from "@/components/demo/demo-doc-viewer";
import DemoSidebar from "@/components/demo/demo-sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@uxie/shared/components/ui/resizable";
import { SidebarDrawerContent } from "@/components/workspace/sidebar-drawer";
import { useDemoDocStore } from "@/lib/demo/store";
import { type ReaderDoc } from "@/types/reader";
import { usePdfSettingsStore } from "@/lib/store";
import { cn, stripTextFromEnd } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { type ImperativePanelHandle } from "react-resizable-panels";
import { useMediaQuery } from "usehooks-ts";
import { useShallow } from "zustand/react/shallow";

const DemoWorkspace = () => {
  // One shallow-compared subscription to the document fields, so the component
  // only re-renders when a field it uses actually changes.
  // One shallow-compared subscription to just the fields the reader renders.
  // `note` is deliberately excluded — it's owned by the sidebar, so leaving it
  // out keeps notes autosaves from re-rendering the (heavy) PDF reader.
  const docFields = useDemoDocStore(
    useShallow((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      isVectorised: s.isVectorised,
      pageCount: s.pageCount,
      highlights: s.highlights,
    })),
  );
  // Snapshot the last-read page for the reader's initial jump. Reading it
  // reactively would re-trigger that jump every time the page changes as the
  // user scrolls. Updates are still persisted to the store for the next visit.
  const [lastReadPage] = useState(() => useDemoDocStore.getState().lastReadPage);

  const doc: ReaderDoc = { ...docFields, lastReadPage };

  const sidebarHidden = usePdfSettingsStore((state) => state.sidebarHidden);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    document.title = stripTextFromEnd(docFields.title, ".pdf");
  }, [docFields.title]);

  useEffect(() => {
    const panel = sidebarPanelRef.current;
    if (!panel) return;
    if (sidebarHidden) {
      panel.collapse();
    } else {
      panel.expand();
    }
  }, [sidebarHidden]);

  const sidebar = <DemoSidebar />;

  return (
    <div className="flex h-screen flex-col">
      <DemoBanner />

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup
          autoSaveId="demo-window-layout"
          direction="horizontal"
        >
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full min-w-[25vw] border-stone-200 bg-white sm:rounded-lg sm:border-r sm:shadow-lg">
              <DemoDocViewer doc={doc} />
            </div>
          </ResizablePanel>
          <div
            className={cn(
              "group hidden items-center justify-center rounded-md bg-gray-50 transition-all duration-200 md:flex",
              sidebarHidden ? "w-0 opacity-0" : "w-2",
            )}
          >
            <ResizableHandle className="h-12 w-1 rounded-full bg-neutral-400 duration-300 group-hover:bg-primary group-active:bg-primary group-active:duration-75 lg:h-24" />
          </div>

          <ResizablePanel
            ref={sidebarPanelRef}
            defaultSize={50}
            minSize={30}
            collapsible
            collapsedSize={0}
            className="hidden md:inline-flex"
          >
            <div className="h-full min-w-[25vw] flex-1">
              {!isMobile && sidebar}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {isMobile && <SidebarDrawerContent>{sidebar}</SidebarDrawerContent>}
      </div>
    </div>
  );
};

export default DemoWorkspace;

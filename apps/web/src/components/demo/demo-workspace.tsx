import DemoBanner from "@/components/demo/demo-banner";
import DemoDocViewer from "@/components/demo/demo-doc-viewer";
import DemoSidebar from "@/components/demo/demo-sidebar";
import { SidebarDrawerContent } from "@/components/workspace/sidebar-drawer";
import { type LoadedPdfForExport } from "@/lib/annotated-pdf-export";
import { useDemoDocStore } from "@/lib/demo/store";
import { usePdfSettingsStore } from "@/lib/store";
import { cn, stripTextFromEnd } from "@/lib/utils";
import { type ReaderDoc } from "@/types/reader";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@uxie/shared/components/ui/resizable";
import { SMALL_SCREEN_QUERY } from "@uxie/shared/lib/constants";
import { useEffect, useRef, useState } from "react";
import { type ImperativePanelHandle } from "react-resizable-panels";
import { useMediaQuery } from "usehooks-ts";
import { useShallow } from "zustand/react/shallow";

const DemoWorkspace = () => {
  // `note` is left out so notes autosaves don't re-render the PDF reader.
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
  // Snapshot the restored page and zoom for the reader's initial layout.
  // Reading them reactively would re-trigger that restore every time the user
  // scrolls or zooms. Updates are still persisted for the next visit.
  const [restored] = useState(() => {
    const { lastReadPage, zoomLevel } = useDemoDocStore.getState();
    return { lastReadPage, zoomLevel };
  });

  const doc: ReaderDoc = { ...docFields, ...restored };

  const sidebarHidden = usePdfSettingsStore((state) => state.sidebarHidden);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const isMobile = useMediaQuery(SMALL_SCREEN_QUERY);
  const [pdfDocument, setPdfDocument] = useState<LoadedPdfForExport | null>(
    null,
  );

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

  const sidebar = (
    <DemoSidebar pdfDocument={pdfDocument} readerDocument={doc} />
  );

  return (
    <div className="flex h-screen flex-col">
      <DemoBanner />

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup
          autoSaveId="demo-window-layout"
          direction="horizontal"
        >
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full min-w-[25vw] border-border bg-background sm:rounded-lg sm:border-r sm:shadow-lg">
              <DemoDocViewer doc={doc} onPdfDocumentChange={setPdfDocument} />
            </div>
          </ResizablePanel>
          <div
            className={cn(
              "group hidden items-center justify-center rounded-md bg-muted/40 transition-all duration-200 md:flex",
              sidebarHidden ? "w-0 opacity-0" : "w-2",
            )}
          >
            <ResizableHandle className="h-12 w-1 rounded-full bg-muted-foreground/60 duration-300 group-hover:bg-primary group-active:bg-primary group-active:duration-75 lg:h-24" />
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

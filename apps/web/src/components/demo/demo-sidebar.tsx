import DemoChat from "@/components/demo/demo-chat";
import DemoFlashcards from "@/components/demo/demo-flashcards";
import BlockNoteEditor from "@/components/editor";
import {
  type AnnotatedPdfExportSource,
  useAnnotatedPdfExportMenuItem,
} from "@/components/workspace/annotated-pdf-export-menu-item";
import { useSidebarTabUrlSync } from "@/hooks/use-sidebar-tab-url-sync";
import { useDemoDocStore } from "@/lib/demo/store";
import { downloadNotes } from "@/lib/notes-export";
import {
  ThemeMenuSub,
  ThemeSheet,
} from "@uxie/shared/components/theme/theme-controls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@uxie/shared/components/ui/dropdown-menu";
import { AnnotatedPdfExportMenuItem } from "@uxie/shared/components/workspace/annotated-pdf-export-menu-item";
import { NotesExportMenuItem } from "@uxie/shared/components/workspace/notes-export-menu-item";
import {
  Sidebar as SharedSidebar,
  SidebarSettingsButton,
} from "@uxie/shared/components/workspace/sidebar";
import { useState } from "react";

const DemoSidebar = (annotatedPdfExport: AnnotatedPdfExportSource) => {
  const exportMenuItem = useAnnotatedPdfExportMenuItem(annotatedPdfExport);
  const setNote = useDemoDocStore((s) => s.setNote);
  // Read once: the editor's useMemo is keyed on `note`, so a reactive read would rebuild it on every autosave.
  const [initialNote] = useState(() => useDemoDocStore.getState().note);
  const [isThemeSheetOpen, setIsThemeSheetOpen] = useState(false);
  useSidebarTabUrlSync();

  return (
    <div className="flex h-full flex-col bg-muted/40">
      <ThemeSheet open={isThemeSheetOpen} onOpenChange={setIsThemeSheetOpen} />
      <SharedSidebar
        headerClassName="md:pl-0 md:pr-1"
        headerActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarSettingsButton />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <NotesExportMenuItem
                onExport={(markdown) =>
                  downloadNotes(
                    markdown,
                    annotatedPdfExport.readerDocument.title,
                  )
                }
              />
              <AnnotatedPdfExportMenuItem {...exportMenuItem} />
              <DropdownMenuSeparator />
              <ThemeMenuSub onOpenSheet={() => setIsThemeSheetOpen(true)} />
            </DropdownMenuContent>
          </DropdownMenu>
        }
        notes={
          <BlockNoteEditor
            canEdit
            note={initialNote}
            enableAi={false}
            onSave={setNote}
          />
        }
        chat={<DemoChat />}
        flashcards={<DemoFlashcards />}
        defaultTab="notes"
        // The URL owns the initial tab here too (useSidebarTabUrlSync above).
        resetTabOnMount={false}
      />
    </div>
  );
};

export default DemoSidebar;

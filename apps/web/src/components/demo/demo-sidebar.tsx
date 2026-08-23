import DemoChat from "@/components/demo/demo-chat";
import DemoFlashcards from "@/components/demo/demo-flashcards";
import BlockNoteEditor from "@/components/editor";
import { useSidebarTabUrlSync } from "@/hooks/use-sidebar-tab-url-sync";
import { useDemoDocStore } from "@/lib/demo/store";
import { useBlocknoteEditorStore } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@uxie/shared/components/ui/dropdown-menu";
import {
  Sidebar as SharedSidebar,
  SidebarSettingsButton,
} from "@uxie/shared/components/workspace/sidebar";
import { saveAs } from "file-saver";
import { Download } from "lucide-react";
import { useState } from "react";

// Same chrome as the real reader's sidebar (@/components/workspace/sidebar) —
// only the panels and the menu items differ, since the demo has no backend.
const DemoSidebar = () => {
  const setNote = useDemoDocStore((s) => s.setNote);
  // Snapshot the note once for the editor's initial content. Reading it
  // reactively would recreate the editor on every autosave (it lives in a
  // useMemo keyed on `note`), tearing down the editor mid-typing.
  const [initialNote] = useState(() => useDemoDocStore.getState().note);
  const { editor } = useBlocknoteEditorStore();
  useSidebarTabUrlSync();

  const handleDownloadMarkdownAsFile = async () => {
    if (!editor) return;
    const markdownContent = await editor.blocksToMarkdownLossy(editor.document);
    const blob = new Blob([markdownContent], { type: "text/markdown" });
    saveAs(blob, "notes.md");
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <SharedSidebar
        headerClassName="md:pl-0 md:pr-1"
        headerActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarSettingsButton />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                disabled={!editor}
                onSelect={handleDownloadMarkdownAsFile}
              >
                <Download size={16} />
                Download notes
              </DropdownMenuItem>
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

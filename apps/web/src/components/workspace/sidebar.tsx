import Chat from "@/components/chat";
import BlockNoteEditor from "@/components/editor";
import Flashcards from "@/components/flashcard";
import { Button } from "@/components/ui/button";
import { CustomTooltip } from "@/components/ui/tooltip";
import { useSidebarTabUrlSync } from "@/hooks/use-sidebar-tab-url-sync";
import { useBlocknoteEditorStore } from "@/lib/store";
import {
  Sidebar as SharedSidebar,
  SidebarTabs,
} from "@uxie/shared/components/workspace/sidebar";
import { saveAs } from "file-saver";
import { BugIcon, Download } from "lucide-react";
import Link from "next/link";
import InviteCollab from "./invite-collab-modal";

const Sidebar = ({
  canEdit,
  isOwner,
  isVectorised,
  note,
}: {
  canEdit: boolean;
  isOwner: boolean;
  isVectorised: boolean;
  note: string | null;
}) => {
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
      <div className="flex items-center justify-between px-2 md:pl-0 md:pr-1">
        <SidebarTabs />
        <div className="flex items-center gap-1">
          {isOwner && (
            <CustomTooltip content="Invite collaborators">
              <InviteCollab />
            </CustomTooltip>
          )}

          <CustomTooltip content="Download notes as markdown">
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto cursor-pointer border-stone-200 bg-white px-2 text-xs shadow-sm sm:border"
              onClick={handleDownloadMarkdownAsFile}
            >
              <Download size={20} />
            </Button>
          </CustomTooltip>

          <CustomTooltip content="Report bug">
            <Link href="/feedback">
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto cursor-pointer border-stone-200 bg-white px-2 text-xs shadow-sm sm:border"
              >
                <BugIcon size={20} />
              </Button>
            </Link>
          </CustomTooltip>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <SharedSidebar
          notes={<BlockNoteEditor canEdit={canEdit} note={note} />}
          chat={<Chat isVectorised={isVectorised} />}
          flashcards={<Flashcards />}
          defaultTab="notes"
          resetTabOnMount={false}
        />
      </div>
    </div>
  );
};
export default Sidebar;

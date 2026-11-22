import Chat from "@/components/chat";
import BlockNoteEditor from "@/components/editor";
import Flashcards from "@/components/flashcard";
import { useSidebarTabUrlSync } from "@/hooks/use-sidebar-tab-url-sync";
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
import { BugIcon, Download, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import InviteCollab from "./invite-collab-modal";

const ARTICLE_SIDEBAR_TABS = ["notes", "chat"] as const;

const Sidebar = ({
  canEdit,
  isOwner,
  isVectorised,
  note,
  showFlashcards = true,
}: {
  canEdit: boolean;
  isOwner: boolean;
  isVectorised: boolean;
  note: string | null;
  showFlashcards?: boolean;
}) => {
  const { editor } = useBlocknoteEditorStore();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  useSidebarTabUrlSync();

  const handleDownloadMarkdownAsFile = async () => {
    if (!editor) return;
    const markdownContent = await editor.blocksToMarkdownLossy(editor.document);

    const blob = new Blob([markdownContent], { type: "text/markdown" });
    saveAs(blob, "notes.md");
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {isOwner && (
        <InviteCollab open={isInviteOpen} onOpenChange={setIsInviteOpen} />
      )}
      <SharedSidebar
        headerClassName="md:pl-0 md:pr-1"
        headerActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarSettingsButton />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {isOwner && (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onSelect={() => setIsInviteOpen(true)}
                >
                  <UserPlus size={16} />
                  Invite collaborators
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                className="cursor-pointer gap-2"
                disabled={!editor}
                onSelect={handleDownloadMarkdownAsFile}
              >
                <Download size={16} />
                Download notes
              </DropdownMenuItem>

              <DropdownMenuItem className="cursor-pointer gap-2" asChild>
                <Link href="/feedback">
                  <BugIcon size={16} />
                  Report a bug
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        notes={<BlockNoteEditor canEdit={canEdit} note={note} />}
        chat={<Chat isVectorised={isVectorised} />}
        flashcards={<Flashcards />}
        tabs={showFlashcards ? undefined : ARTICLE_SIDEBAR_TABS}
        defaultTab="notes"
        resetTabOnMount={false}
      />
    </div>
  );
};
export default Sidebar;

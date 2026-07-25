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
  SidebarHeader,
} from "@uxie/shared/components/workspace/sidebar";
import { saveAs } from "file-saver";
import { BugIcon, Download, SettingsIcon, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
      <SidebarHeader className="md:pl-0 md:pr-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Document options"
            className="ml-auto rounded-md p-1.5 text-muted-foreground transition-all duration-150 hover:bg-gray-100 hover:text-foreground active:scale-90"
          >
            <SettingsIcon
              size={18}
              className="transition-transform duration-300 hover:rotate-45"
            />
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
      </SidebarHeader>

      {isOwner && (
        <InviteCollab open={isInviteOpen} onOpenChange={setIsInviteOpen} />
      )}

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

import Chat from "@/components/chat";
import BlockNoteEditor from "@/components/editor";
import Flashcards from "@/components/flashcard";
import {
  type AnnotatedPdfExportSource,
  useAnnotatedPdfExportMenuItem,
} from "@/components/workspace/annotated-pdf-export-menu-item";
import { useSidebarTabUrlSync } from "@/hooks/use-sidebar-tab-url-sync";
import { downloadNotes } from "@/lib/notes-export";
import {
  ThemeMenuSub,
  ThemeSheet,
} from "@uxie/shared/components/theme/theme-controls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@uxie/shared/components/ui/dropdown-menu";
import { AnnotatedPdfExportMenuItem } from "@uxie/shared/components/workspace/annotated-pdf-export-menu-item";
import { NotesExportMenuItem } from "@uxie/shared/components/workspace/notes-export-menu-item";
import {
  Sidebar as SharedSidebar,
  SidebarSettingsButton,
} from "@uxie/shared/components/workspace/sidebar";
import { BugIcon, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import InviteCollab from "./invite-collab-modal";

const ARTICLE_SIDEBAR_TABS = ["notes", "chat"] as const;

const Sidebar = ({
  canEdit,
  isOwner,
  isVectorised,
  note,
  title,
  annotatedPdfExport,
  showFlashcards = true,
}: {
  canEdit: boolean;
  isOwner: boolean;
  isVectorised: boolean;
  note: string | null;
  title: string | null;
  annotatedPdfExport?: AnnotatedPdfExportSource;
  showFlashcards?: boolean;
}) => {
  const exportMenuItem = useAnnotatedPdfExportMenuItem(annotatedPdfExport);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isThemeSheetOpen, setIsThemeSheetOpen] = useState(false);
  useSidebarTabUrlSync();

  return (
    <div className="flex h-full flex-col bg-muted/40">
      <ThemeSheet open={isThemeSheetOpen} onOpenChange={setIsThemeSheetOpen} />
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

              <NotesExportMenuItem
                onExport={(markdown) => downloadNotes(markdown, title)}
              />

              {annotatedPdfExport && (
                <AnnotatedPdfExportMenuItem {...exportMenuItem} />
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem className="cursor-pointer gap-2" asChild>
                <Link href="/feedback">
                  <BugIcon size={16} />
                  Report a bug
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <ThemeMenuSub onOpenSheet={() => setIsThemeSheetOpen(true)} />
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

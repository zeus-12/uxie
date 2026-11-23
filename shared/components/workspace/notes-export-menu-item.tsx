import { Download } from "lucide-react";
import { notesToMarkdown } from "../../lib/notes-export";
import { useBlocknoteEditorStore } from "../../lib/store";
import { DropdownMenuItem } from "../ui/dropdown-menu";
import { toast } from "../ui/sonner";

export function NotesExportMenuItem({
  onExport,
}: {
  onExport: (markdown: string) => Promise<void>;
}) {
  const editor = useBlocknoteEditorStore((s) => s.editor);

  const exportNotes = async () => {
    if (!editor) return;
    try {
      await onExport(await notesToMarkdown(editor));
    } catch (error) {
      toast.error("Couldn't export notes", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <DropdownMenuItem
      className="cursor-pointer gap-2"
      disabled={!editor}
      onSelect={() => void exportNotes()}
    >
      <Download size={16} />
      Export notes
    </DropdownMenuItem>
  );
}

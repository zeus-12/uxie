import Editor from "@uxie/shared/components/editor";
import { toast } from "@uxie/shared/components/ui/sonner";
import { useIpcCompletion } from "./use-ipc-completion";

export function Notes({ docId, note }: { docId: string; note: string | null }) {
  const ai = useIpcCompletion({
    onError: (message) => toast.error(message, { duration: 3000 }),
  });

  return (
    <Editor
      canEdit
      note={note}
      ai={ai}
      onSaveNotes={(n) => void window.uxieAPI.updateDocumentNotes(docId, n)}
    />
  );
}

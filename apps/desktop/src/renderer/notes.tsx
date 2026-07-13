import Editor from "@uxie/shared/components/editor";

export function Notes({ docId, note }: { docId: string; note: string | null }) {
  return (
    <Editor
      canEdit
      note={note}
      onSaveNotes={(n) => void window.uxieAPI.updateDocumentNotes(docId, n)}
    />
  );
}

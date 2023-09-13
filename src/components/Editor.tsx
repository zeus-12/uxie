import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView, useBlockNote } from "@blocknote/react";
import "@blocknote/core/style.css";
import { useTheme } from "next-themes";

function Editor() {
  const { theme } = useTheme();

  const editor: BlockNoteEditor | null = useBlockNote({});

  return (
    <BlockNoteView
      className="h-full"
      // add default value and onUpdate with debouncing
      theme={theme === "dark" ? "dark" : "light"}
      editor={editor}
    />
  );
}

export default Editor;

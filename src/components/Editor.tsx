import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView, useBlockNote } from "@blocknote/react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";

function Editor() {
  const { theme } = useTheme();
  // const [markdown, setMarkdown] = useState<string>("");

  const debounced = useDebouncedCallback((value) => {
    console.log("saving to db", value);
  }, 3000);

  const editor: BlockNoteEditor | null = useBlockNote({
    onEditorContentChange: (editor) => {
      // setMarkdown(JSON.stringify(editor.topLevelBlocks));
      debounced(JSON.stringify(editor.topLevelBlocks));
    },
  });

  return (
    <>
      <BlockNoteView
        className="h-full"
        theme={theme === "dark" ? "dark" : "light"}
        editor={editor}
        // defaultValue={JSON.parse(
        //   '[{"type":"paragraph","children":[{"text":"Hello world!"}]}]',
        // )}
      />
      {/* <pre>{markdown}</pre> */}
    </>
  );
}

export default Editor;

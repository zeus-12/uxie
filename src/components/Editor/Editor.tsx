import { defaultBlockSchema } from "@blocknote/core";
import {
  BlockNoteView,
  getDefaultReactSlashMenuItems,
  useBlockNote,
  FormattingToolbarPositioner,
  DefaultFormattingToolbar,
  defaultBlockTypeDropdownItems,
  HyperlinkToolbarPositioner,
  SlashMenuPositioner,
  SideMenuPositioner,
} from "@blocknote/react";
import { AlertCircle, Highlighter, HighlighterIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { createAlertBlock, insertAlert } from "./CustomBlocks/Alert";
import {
  createHighlightBlock,
  insertHighlight,
} from "./CustomBlocks/Highlight";

function Editor() {
  const { theme } = useTheme();
  const [markdown, setMarkdown] = useState<string>("");

  const schemaWithCustomBlocks = {
    ...defaultBlockSchema,
    alert: createAlertBlock(theme === "dark" ? "dark" : "light"),
    highlight: createHighlightBlock(theme === "dark" ? "dark" : "light"),
  };

  const debounced = useDebouncedCallback((value) => {
    setMarkdown(JSON.stringify(value));
    console.log("saving to db", value);
  }, 3000);

  const editor = useBlockNote({
    onEditorContentChange: (editor) => {
      debounced(JSON.stringify(editor.topLevelBlocks));
    },
    blockSchema: schemaWithCustomBlocks,
    slashMenuItems: [
      ...getDefaultReactSlashMenuItems(schemaWithCustomBlocks),
      insertAlert,
      insertHighlight,
    ],
  });

  const addtext = () => {
    editor.insertBlocks(
      [
        {
          content: "test",
          // "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaasdfadsfmoremroemooremoremomrdfadsfmoremroemooremoremomrdfadsfmoremroemooremoremomrdfadsfmoremroemooremoremomrdfadsfmoremroemooremoremomrdfadsfmoremroemooremoremomrdfadsfmoremroemooremoremomr",
          // type: "highlight",
          type: "alert",
        },
      ],
      editor.getTextCursorPosition().block,
      "after",
    );
  };

  return (
    <div className="h-[calc(100vh_-_3rem)] w-full flex-1 overflow-scroll">
      <BlockNoteView
        className="w-full flex-1"
        theme={theme === "dark" ? "dark" : "light"}
        editor={editor}
      >
        <FormattingToolbarPositioner
          editor={editor}
          formattingToolbar={(props) => (
            <DefaultFormattingToolbar
              {...props}
              blockTypeDropdownItems={[
                ...defaultBlockTypeDropdownItems,
                {
                  name: "Alert",
                  type: "alert",
                  icon: AlertCircle as any,
                  // @ts-ignore
                  isSelected: (block) => block.type === "alert",
                },
                {
                  name: "Highlight",
                  type: "highlight",
                  icon: Highlighter as any,
                  // @ts-ignore
                  isSelected: (block) => block.type === "highlight",
                },
              ]}
            />
          )}
        />
        <HyperlinkToolbarPositioner editor={editor} />
        <SlashMenuPositioner editor={editor} />
        <SideMenuPositioner editor={editor} />
      </BlockNoteView>
      {/* <button onClick={addtext}>add text</button> */}
    </div>
  );
}

export default Editor;

import {
  BlockNoteView,
  FormattingToolbarPositioner,
  DefaultFormattingToolbar,
  defaultBlockTypeDropdownItems,
  HyperlinkToolbarPositioner,
  SlashMenuPositioner,
  SideMenuPositioner,
  ImageToolbarPositioner,
} from "@blocknote/react";
import { AlertCircle, Highlighter, Image } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

function Editor({ editor }: { editor: any }) {
  const { theme } = useTheme();
  const [markdown, setMarkdown] = useState<string>("");

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
                  isSelected: (block) => block.type === "alert",
                },
                // {
                //   name: "Highlight",
                //   type: "highlight",
                //   icon: Highlighter as any,
                //   // @ts-ignore
                //   isSelected: (block) => block.type === "highlight",
                // },
              ]}
            />
          )}
        />
        <HyperlinkToolbarPositioner editor={editor} />
        <SlashMenuPositioner editor={editor} />
        <SideMenuPositioner editor={editor} />
        <ImageToolbarPositioner editor={editor} />
      </BlockNoteView>
      {/* <button onClick={addtext}>add text</button> */}
    </div>
  );
}

export default Editor;

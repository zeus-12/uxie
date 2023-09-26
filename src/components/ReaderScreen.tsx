import DocViewer from "@/components/DocViewer";
import Sidebar from "@/components/Sidebar";
import { MouseEvent, useState } from "react";
import { defaultBlockSchema } from "@blocknote/core";
import { getDefaultReactSlashMenuItems, useBlockNote } from "@blocknote/react";
import {
  createAlertBlock,
  insertAlert,
} from "@/components/Editor/CustomBlocks/Alert";
import {
  createHighlightBlock,
  insertHighlight,
} from "@/components/Editor/CustomBlocks/Highlight";
import {
  createImageBlock,
  insertImage,
} from "@/components/Editor/CustomBlocks/Image";
import { useDebouncedCallback } from "use-debounce";
import { useTheme } from "next-themes";

const DocViewerPage = () => {
  const [width, setWidth] = useState<null | number>();
  const [mouseDown, setMouseDown] = useState(false);

  const handleMouseDown = (event: MouseEvent<HTMLOrSVGElement>) => {
    setMouseDown(true);
    event.preventDefault();
  };

  const handleMouseUp = (_event: MouseEvent<HTMLDivElement>) => {
    setMouseDown(false);
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    // if (event.pageX < 300) return;
    if (mouseDown) {
      setWidth(event.pageX);
    }
  };

  const { theme } = useTheme();

  const schemaWithCustomBlocks = {
    ...defaultBlockSchema,
    alert: createAlertBlock(theme === "dark" ? "dark" : "light"),
    highlight: createHighlightBlock(theme === "dark" ? "dark" : "light"),
    // image: createImageBlock(theme === "dark" ? "dark" : "light"),
  };

  const debounced = useDebouncedCallback((value) => {
    // setMarkdown(JSON.stringify(value));
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
      // insertHighlight,
      // insertImage,
    ],
  });

  const addHighlightToNotes = (content: string) => {
    console.log(content);
    if (!content) return;
    editor.insertBlocks(
      [
        {
          content: content,
          type: "highlight",
        },
      ],
      editor.getTextCursorPosition().block,
      "after",
    );

    editor.setTextCursorPosition(editor.getTextCursorPosition().nextBlock!);
  };

  return (
    <div
      className="flex"
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      <div
        className="h-screen "
        style={{ width: width ?? "50vw", minWidth: "25vw" }}
      >
        <DocViewer addHighlightToNotes={addHighlightToNotes} />
      </div>
      <div className="flex items-center">
        {/* move this to icons.tsx */}
        <svg
          onMouseDown={handleMouseDown}
          className="px-auto w-4 cursor-col-resize "
          viewBox="0 0 16 16"
          fill="#000"
        >
          <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"></path>
        </svg>
      </div>
      <div
        className="h-screen flex-1"
        style={{
          minWidth: "25vw",
        }}
      >
        <Sidebar editor={editor} />
      </div>
    </div>
  );
};
export default DocViewerPage;

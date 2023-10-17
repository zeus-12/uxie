import DocViewer from "@/components/DocViewer";
import Sidebar from "@/components/Sidebar";
import { MouseEvent, useState } from "react";
import {
  defaultBlockSchema,
  uploadToTmpFilesDotOrg_DEV_ONLY,
} from "@blocknote/core";
import { getDefaultReactSlashMenuItems, useBlockNote } from "@blocknote/react";
import {
  createAlertBlock,
  insertAlert,
} from "@/components/Editor/CustomBlocks/Alert";
import { createHighlightBlock } from "@/components/Editor/CustomBlocks/Highlight";
import { useDebouncedCallback } from "use-debounce";
import { useTheme } from "next-themes";
import { Icons } from "@/components/icons";
import { HighlightContentType } from "@/lib/types";

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
  };
  const [markdown, setMarkdown] = useState<any>([]);

  const debounced = useDebouncedCallback((value) => {
    setMarkdown(value);
    console.log("saving to db", value);
  }, 3000);

  const editor = useBlockNote({
    onEditorContentChange: (editor) => {
      debounced(JSON.stringify(editor.topLevelBlocks, null, 2));
    },

    blockSchema: schemaWithCustomBlocks,
    uploadFile: uploadToTmpFilesDotOrg_DEV_ONLY,

    slashMenuItems: [
      ...getDefaultReactSlashMenuItems(schemaWithCustomBlocks),
      insertAlert,
      // insertHighlight,
    ],
  });

  const addHighlightToNotes = (
    content: string,
    highlightId: string,
    type: HighlightContentType,
  ) => {
    if (type === HighlightContentType.TEXT) {
      if (!content || !highlightId) return;

      const block = editor.getTextCursorPosition().block;
      const blockIsEmpty = block.content?.length === 0;

      if (blockIsEmpty) {
        editor.updateBlock(block, {
          content: content,
          props: {
            highlightId: highlightId,
          },
          type: "highlight",
        });
      } else {
        editor.insertBlocks(
          [
            {
              content: content,
              props: {
                highlightId: highlightId,
              },
              type: "highlight",
            },
          ],
          editor.getTextCursorPosition().block,
          "after",
        );
        editor.setTextCursorPosition(editor.getTextCursorPosition().nextBlock!);
      }
    } else {
      if (!content || !highlightId) return;

      try {
        // if (editor.uploadFile) {
        const block = editor.getTextCursorPosition().block;
        const blockIsEmpty = block.content?.length === 0;

        //   const data = await fetch(content);
        //   const blob = await data.blob();

        //   const file = new File([blob], content, { type: "image/png" });

        //   const link = await editor.uploadFile(file);
        //   console.log(link, "link");

        //   console.log("uploadedd");

        if (blockIsEmpty) {
          editor.updateBlock(block, {
            props: {
              url: content,
            },
            type: "image",
          });
        } else {
          editor.insertBlocks(
            [
              {
                props: {
                  url: content,
                },
                type: "image",
              },
            ],
            editor.getTextCursorPosition().block,
            "after",
          );
          editor.setTextCursorPosition(
            editor.getTextCursorPosition().nextBlock!,
          );
        }
      } catch (err: any) {
        console.log(err.message, "errnes");
      }
    }
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
        <Icons.resizeHandle
          className="px-auto w-4 cursor-col-resize "
          onMouseDown={handleMouseDown}
        />
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

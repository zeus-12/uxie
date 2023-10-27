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
import { ResizeHandleIcon } from "@/components/icons";
import { HighlightContentType } from "@/types";
import { api } from "@/lib/api";
import { useRouter } from "next/router";

const DocViewerPage = () => {
  const { query } = useRouter();

  const { data: initialNotes } = api.document.getNotes.useQuery(
    {
      docId: query?.docId as string,
    },
    {
      enabled: !!query?.docId,
    },
  );

  const [width, setWidth] = useState<null | number>();
  const [mouseDown, setMouseDown] = useState(false);

  const { mutate: updateNotesMutation } =
    api.document.updateNotes.useMutation();

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

  const debounced = useDebouncedCallback((value) => {
    updateNotesMutation({
      markdown: value,
      documentId: query?.docId as string,
    });
  }, 3000);

  const editor = useBlockNote(
    {
      initialContent: initialNotes ? JSON.parse(initialNotes) : undefined,
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
    },
    [initialNotes],
  );

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
        const block = editor.getTextCursorPosition().block;
        const blockIsEmpty = block.content?.length === 0;

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
      <div className="flex w-4 items-center rounded-md bg-gray-50">
        <ResizeHandleIcon
          size={18}
          className="cursor-col-resize "
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

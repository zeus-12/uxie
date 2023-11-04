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

  const schemaWithCustomBlocks = {
    ...defaultBlockSchema,
    alert: createAlertBlock(),
    highlight: createHighlightBlock(),
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
      // editable: check if user is not owner or collaborator w. edit access.
      // todo add collaboration feature

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
        className="h-screen border-stone-200 bg-white sm:rounded-lg sm:border-r sm:shadow-lg"
        style={{ width: width ?? "50vw", minWidth: "25vw" }}
      >
        <DocViewer addHighlightToNotes={addHighlightToNotes} />
      </div>
      <div
        className="group flex w-2 cursor-col-resize items-center justify-center rounded-md bg-gray-50"
        onMouseDown={handleMouseDown}
      >
        <div className="h-1 w-24 rounded-full bg-neutral-400 duration-300 group-hover:bg-primary group-active:bg-primary group-active:duration-75 dark:bg-neutral-700 group-hover:dark:bg-primary lg:h-24 lg:w-1" />
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

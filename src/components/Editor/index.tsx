import {
  BlockNoteView,
  FormattingToolbarPositioner,
  DefaultFormattingToolbar,
  defaultBlockTypeDropdownItems,
  HyperlinkToolbarPositioner,
  SlashMenuPositioner,
  SideMenuPositioner,
  ImageToolbarPositioner,
  useBlockNote,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { AlertCircle } from "lucide-react";
import { uploadToTmpFilesDotOrg_DEV_ONLY } from "@blocknote/core";
import { useRouter } from "next/router";
import { api } from "@/lib/api";
import { defaultBlockSchema } from "@blocknote/core";
import {
  createAlertBlock,
  insertAlert,
} from "@/components/Editor/CustomBlocks/Alert";
import { createHighlightBlock } from "@/components/Editor/CustomBlocks/Highlight";
import { useDebouncedCallback } from "use-debounce";
import { useBlocknoteEditorStore } from "@/lib/store";
import { useEffect } from "react";

function Editor() {
  const { query } = useRouter();
  const { mutate: updateNotesMutation } =
    api.document.updateNotes.useMutation();

  const { data: initialNotes } = api.document.getNotes.useQuery(
    {
      docId: query?.docId as string,
    },
    {
      enabled: !!query?.docId,
    },
  );

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

  const { setEditor, editor: _editor } = useBlocknoteEditorStore();

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
      domAttributes: {
        editor: {
          class: "mt-6",
        },
      },

      slashMenuItems: [
        ...getDefaultReactSlashMenuItems(schemaWithCustomBlocks),
        insertAlert,
        // insertHighlight,
      ],
    },
    [initialNotes],
  );

  useEffect(() => {
    if (editor !== _editor) {
      setEditor(editor);
    }
  }, [editor]);

  return (
    <div className="h-[calc(100vh_-_3rem)] w-full flex-1 overflow-scroll">
      <BlockNoteView className="w-full flex-1" theme={"light"} editor={editor}>
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
              ]}
            />
          )}
        />
        <HyperlinkToolbarPositioner editor={editor} />
        <SlashMenuPositioner editor={editor} />
        <SideMenuPositioner editor={editor} />
        <ImageToolbarPositioner editor={editor} />
      </BlockNoteView>
    </div>
  );
}

export default Editor;

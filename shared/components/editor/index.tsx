import "@blocknote/mantine/style.css";
import { getSlashMenuItems, schema } from "../../lib/editor-utils";
import { useBlocknoteEditorStore } from "../../lib/store";
import {
  BlockNoteEditor,
  filterSuggestionItems,
  uploadToTmpFilesDotOrg_DEV_ONLY,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
  BasicTextStyleButton,
  BlockColorsItem,
  BlockTypeSelect,
  ColorStyleButton,
  CreateLinkButton,
  DragHandleMenu,
  FileCaptionButton,
  FormattingToolbar,
  FormattingToolbarController,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  TextAlignButton,
} from "@blocknote/react";
import { useLayoutEffect, useMemo } from "react";
import { toast } from "sonner";
import { SpinnerCentered } from "../ui/spinner";
import { useDebouncedCallback } from "use-debounce";

export default function Editor({
  canEdit,
  note,
  onSaveNotes,
}: {
  canEdit: boolean;
  note: string | null;
  onSaveNotes: (note: string) => void;
}) {
  const debounced = useDebouncedCallback((value: string) => {
    onSaveNotes(value);
  }, 2000);

  const { setEditor } = useBlocknoteEditorStore();

  const editor = useMemo(() => {
    try {
      const initialContent = note ? JSON.parse(note) : undefined;

      return BlockNoteEditor.create({
        initialContent: initialContent,
        schema,
        uploadFile: uploadToTmpFilesDotOrg_DEV_ONLY as (
          file: File,
          blockId?: string,
        ) => Promise<string>,

        domAttributes: {
          editor: {
            class: "my-6",
          },
        },
      });
    } catch (err) {
      toast.error("Error parsing note", { duration: 3000 });
      return undefined;
    }
  }, [note]);

  useLayoutEffect(() => {
    if (!editor) return;

    setEditor(editor);
  }, [editor, setEditor]);

  if (editor === undefined) {
    return <SpinnerCentered />;
  }

  return (
    <div>
      <BlockNoteView
        sideMenu={false}
        onChange={() => {
          debounced(JSON.stringify(editor.document, null, 2));
        }}
        className="w-full flex-1"
        theme={"light"}
        editor={editor}
        slashMenu={false}
        editable={canEdit}
        formattingToolbar={false}
      >
        <SuggestionMenuController
          triggerCharacter={"/"}
          getItems={async (query) =>
            filterSuggestionItems(getSlashMenuItems(editor), query)
          }
        />

        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              <BlockTypeSelect key={"blockTypeSelect"} />

              <FileCaptionButton key="fileCaptionButton" />

              <BasicTextStyleButton
                basicTextStyle={"bold"}
                key={"boldStyleButton"}
              />
              <BasicTextStyleButton
                basicTextStyle={"italic"}
                key={"italicStyleButton"}
              />
              <BasicTextStyleButton
                basicTextStyle={"underline"}
                key={"underlineStyleButton"}
              />
              <BasicTextStyleButton
                basicTextStyle={"strike"}
                key={"strikeStyleButton"}
              />
              <BasicTextStyleButton
                key={"codeStyleButton"}
                basicTextStyle={"code"}
              />

              <TextAlignButton
                textAlignment={"left"}
                key={"textAlignLeftButton"}
              />
              <TextAlignButton
                textAlignment={"center"}
                key={"textAlignCenterButton"}
              />
              <TextAlignButton
                textAlignment={"right"}
                key={"textAlignRightButton"}
              />

              <ColorStyleButton key={"colorStyleButton"} />

              <CreateLinkButton key={"createLinkButton"} />
            </FormattingToolbar>
          )}
        />

        <SideMenuController
          sideMenu={(props) => (
            <SideMenu
              {...props}
              dragHandleMenu={(props) => (
                <DragHandleMenu {...props}>
                  <RemoveBlockItem {...props}>Delete</RemoveBlockItem>
                  {/* TODO(desktop-ai): inline AI block action (AiDragHandleMenu + AiPopover) — wire over IPC */}
                  <BlockColorsItem {...props}>Colors</BlockColorsItem>
                </DragHandleMenu>
              )}
            />
          )}
        />
        {/* TODO(desktop-ai): AiPopover rendered here in web via useCompletion; wire over IPC */}
      </BlockNoteView>
    </div>
  );
}

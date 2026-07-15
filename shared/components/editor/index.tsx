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
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { SpinnerCentered } from "../ui/spinner";
import { useDebouncedCallback } from "use-debounce";

/** Minimal streaming-completion contract (matches the AI SDK's useCompletion). */
export type EditorAiCompletion = {
  complete: (prompt: string) => void;
  completion: string;
  isLoading: boolean;
  stop: () => void;
};

export default function Editor({
  canEdit,
  note,
  onSaveNotes,
  ai,
}: {
  canEdit: boolean;
  note: string | null;
  onSaveNotes: (note: string) => void;
  ai?: EditorAiCompletion | null;
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

  const completion = ai?.completion ?? "";
  const isLoading = ai?.isLoading ?? false;
  const stop = ai?.stop;

  // The block being completed and its text before generation started. We rewrite
  // the whole block as `base + completion` on every tick (idempotent) instead of
  // appending per-delta diffs — appending would race the async markdown read and
  // drop/reorder tokens under a fast stream.
  const gen = useRef<{ blockId: string; base: string } | null>(null);

  useEffect(() => {
    if (!editor) return;
    const target = gen.current;
    if (!target || !completion) return;
    editor.updateBlock(target.blockId, {
      content: target.base + completion,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completion]);

  // Escape / cmd+z aborts an in-flight generation and restores the "++" trigger.
  useEffect(() => {
    if (!editor || !ai || !isLoading) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.metaKey && e.key === "z")) {
        stop?.();
        const target = gen.current;
        if (target) {
          editor.updateBlock(target.blockId, { content: `${target.base}++` });
        }
        gen.current = null;
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stop?.();
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [editor, ai, isLoading, stop, completion.length]);

  if (editor === undefined) {
    return <SpinnerCentered />;
  }

  return (
    <div>
      <BlockNoteView
        sideMenu={false}
        onChange={async () => {
          if (ai && !isLoading) {
            const block = editor.getTextCursorPosition().block;
            const blockText = (
              await editor.blocksToMarkdownLossy([block])
            ).trim();
            if (blockText.slice(-2) === "++") {
              const base = blockText.slice(0, -2);
              editor.updateBlock(block, { content: base });
              gen.current = { blockId: block.id, base };
              ai.complete(blockText.slice(-500));
            }
          }
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

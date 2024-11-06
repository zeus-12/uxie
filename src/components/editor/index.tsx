import { getSlashMenuItems, schema } from "@/lib/editor-utils";
import { useBlocknoteEditorStore } from "@/lib/store";
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
  DragHandleMenuProps,
  FileCaptionButton,
  FormattingToolbar,
  FormattingToolbarController,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  TextAlignButton,
  useBlockNoteEditor,
  useComponentsContext,
} from "@blocknote/react";
import { useCompletion } from "ai/react";
import {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
// import { CommentFormattingToolbarButton } from "@/components/Editor/CustomBlocks/Comment";
import AiPopover, {
  AiPopoverPropsRect,
} from "@/components/editor/custom/ai/popover";
import { SpinnerCentered } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useRouter } from "next/router";
import { useDebouncedCallback } from "use-debounce";

// export default function Editor({
//   canEdit,
//   username,
// }: {
//   canEdit: boolean;
//   username: string;
// }) {
//   const room = useRoom();
//   const [doc, setDoc] = useState<Y.Doc>();
//   const [provider, setProvider] = useState<any>();

//   // Set up Liveblocks Yjs provider
//   useEffect(() => {
//     const yDoc = new Y.Doc();
//     const yProvider = new LiveblocksProvider(room, yDoc);

//     setDoc(yDoc);
//     setProvider(yProvider);

//     return () => {
//       yDoc?.destroy();
//       yProvider?.destroy();
//     };
//   }, [room]);

//   if (!doc || !provider) {
//     return null;
//   }

//   return (
//     <BlockNoteEditor
//       canEdit={canEdit}
//       username={username}
//       doc={doc}
//       provider={provider}
//     />
//   );
// }

export default function Editor({
  canEdit,
  note,
}: {
  canEdit: boolean;
  note: string | null;
}) {
  const { mutate: updateNotesMutation } =
    api.document.updateNotes.useMutation();

  const { query } = useRouter();
  const documentId = query?.docId as string;

  const debounced = useDebouncedCallback((value) => {
    updateNotesMutation({
      note: value,
      documentId,
    });
  }, 2000);

  const { setEditor } = useBlocknoteEditorStore();

  const { complete, completion, isLoading, stop } = useCompletion({
    onFinish: (_prompt, completion) => {
      // select the text that was just inserted
      // editor?._tiptapEditor.commands.setTextSelection({
      //   from: editor._tiptapEditor.state.selection.from - completion.length,
      //   to: editor._tiptapEditor.state.selection.from,
      // });

      editor?._tiptapEditor.commands.focus("end");
    },
    onError: (err) => {
      toast.error("Something went wrong with text generation", {
        duration: 3000,
      });
    },
  });

  // const generateAiContent = (editor: BlockNoteEditorType) => {
  //   complete(
  //     getPrevText(editor._tiptapEditor, {
  //       chars: 500,
  //       offset: 1,
  //     }),
  //   );
  // };
  // const insertAi: ReactSlashMenuItem<typeof blockSchema> = {
  //   name: "Continue with AI",
  //   execute: generateAiContent,
  //   aliases: ["ai", "fill"],
  //   group: "AI",
  //   icon: <Bot size={24} />,
  //   hint: "Continue your idea with some extra inspiration!",
  // };

  const editor = useMemo(() => {
    try {
      // TODO note is null by "default" => should prob set the default value in prisma schemas as "[]"
      const initialContent = note ? JSON.parse(note) : undefined;

      return BlockNoteEditor.create({
        initialContent: initialContent,
        schema,
        // ...(isDev
        //   ? {}
        //   : {
        //       collaboration: {
        //         provider,
        //         fragment: doc.getXmlFragment("document-store"),
        //         user: {
        //           name: username || "User",
        //           color: getRandomLightColor(),
        //         },
        //       },
        //     }),

        // todo replace this with our storage
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

  useEffect(() => {
    if (!editor) return;

    setEditor(editor);
  }, [editor]);

  const prev = useRef("");

  useEffect(() => {
    if (!editor) return;

    const streamCompletion = async () => {
      const diff = completion?.slice(prev.current.length);
      prev.current = completion;

      const block = editor.getTextCursorPosition().block;
      const blockText = (await editor?.blocksToMarkdownLossy([block]))?.trim();

      editor.updateBlock(editor.getTextCursorPosition().block, {
        id: editor.getTextCursorPosition().block.id,
        content: blockText + diff,
      });
    };

    streamCompletion();
  }, [isLoading, completion]);

  useEffect(() => {
    if (!editor) return;

    // if user presses escape or cmd + z and it's loading,
    // stop the request, delete the completion, and insert back the "++"
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.metaKey && e.key === "z")) {
        stop();
        if (e.key === "Escape") {
          editor?._tiptapEditor.commands.deleteRange({
            from: editor._tiptapEditor.state.selection.from - completion.length,
            to: editor._tiptapEditor.state.selection.from,
          });
        }
        editor?._tiptapEditor.commands.insertContent("++");
      }
    };
    const mousedownHandler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stop();
    };
    if (isLoading) {
      document.addEventListener("keydown", onKeyDown);
      window.addEventListener("mousedown", mousedownHandler);
    } else {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", mousedownHandler);
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", mousedownHandler);
    };
  }, [stop, isLoading, editor, complete, completion.length]);

  const [rect, setRect] = useState<AiPopoverPropsRect | null>(null);

  if (editor === undefined) {
    return <SpinnerCentered />;
  }

  return (
    <div>
      <BlockNoteView
        sideMenu={false}
        onChange={async () => {
          const block = editor.getTextCursorPosition().block;
          const blockText = (
            await editor.blocksToMarkdownLossy([block])
          ).trim();

          const lastTwo = blockText?.slice(-2);
          if (lastTwo === "++" && !isLoading) {
            editor.updateBlock(block, {
              id: block.id,
              content: blockText?.slice(0, -2),
            });
            complete(blockText?.slice(-500) ?? "");
          }
          // this is firing on initial load => store server value in useRef, and display a icon saying "loading" or "saved". and only if its different from current copy run the mutation
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

              {/* <CommentFormattingToolbarButton key={"customButton"} /> */}

              {/* <ImageCaptionButton key={"imageCaptionButton"} />
              <ReplaceImageButton key={"replaceImageButton"} /> */}
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

              {/* <NestBlockButton key={"nestBlockButton"} />
              <UnnestBlockButton key={"unnestBlockButton"} /> */}

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
                  <AiDragHandleMenu {...props} setRect={setRect} />

                  <BlockColorsItem {...props}>Colors</BlockColorsItem>
                </DragHandleMenu>
              )}
            />
          )}
        />
        {rect && <AiPopover rect={rect} setRect={setRect} />}
      </BlockNoteView>
    </div>
  );
}

const AiDragHandleMenu = (
  props: DragHandleMenuProps & {
    setRect: Dispatch<SetStateAction<AiPopoverPropsRect | null>>;
  },
) => {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext()!;

  return (
    <Components.Generic.Menu.Item
      onClick={async () => {
        const blockDiv = document.querySelector(
          `div[data-id="${props.block.id}"]`,
        ) as HTMLElement;

        if (!blockDiv) return;

        // select the div
        // const selection = window.getSelection();
        // const range = document.createRange();
        // range.selectNodeContents(blockDiv);
        // selection?.removeAllRanges();
        // selection?.addRange(range);

        // scroll to the div
        // blockDiv.scrollIntoView({
        //   behavior: "smooth",
        //   block: "center",
        // });

        const rect = blockDiv.getBoundingClientRect();
        const top = rect.top + rect.height;
        const left = rect.left;
        const width = rect.width;

        const text = await editor.blocksToMarkdownLossy([props.block]);

        props.setRect({
          top,
          left,
          width,
          blockId: props.block.id,
          text,
        });
      }}
    >
      AI
    </Components.Generic.Menu.Item>
  );
};

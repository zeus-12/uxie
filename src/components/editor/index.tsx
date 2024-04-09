import { toast } from "@/components/ui/use-toast";
import { getSlashMenuItems, schema } from "@/lib/editor-utils";
import { useBlocknoteEditorStore } from "@/lib/store";
import { getRandomLightColor, isDev } from "@/lib/utils";
import { YjsEditorProps } from "@/types/editor";
import {
  filterSuggestionItems,
  uploadToTmpFilesDotOrg_DEV_ONLY,
} from "@blocknote/core";
import {
  BasicTextStyleButton,
  BlockColorsItem,
  BlockNoteView,
  BlockTypeSelect,
  ColorStyleButton,
  CreateLinkButton,
  DragHandleMenu,
  DragHandleMenuItem,
  FormattingToolbar,
  FormattingToolbarController,
  ImageCaptionButton,
  RemoveBlockItem,
  ReplaceImageButton,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  TextAlignButton,
  useCreateBlockNote,
} from "@blocknote/react";
import LiveblocksProvider from "@liveblocks/yjs";
import { useCompletion } from "ai/react";
import { useRoom } from "liveblocks.config";
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
// import { CommentFormattingToolbarButton } from "@/components/Editor/CustomBlocks/Comment";
import AiPopover, {
  AiPopoverPropsRect,
} from "@/components/editor/custom/ai/popover";

export default function Editor({
  canEdit,
  username,
}: {
  canEdit: boolean;
  username: string;
}) {
  const room = useRoom();
  const [doc, setDoc] = useState<Y.Doc>();
  const [provider, setProvider] = useState<any>();

  // Set up Liveblocks Yjs provider
  useEffect(() => {
    const yDoc = new Y.Doc();
    const yProvider = new LiveblocksProvider(room, yDoc);

    setDoc(yDoc);
    setProvider(yProvider);

    return () => {
      yDoc?.destroy();
      yProvider?.destroy();
    };
  }, [room]);

  if (!doc || !provider) {
    return null;
  }

  return (
    <BlockNoteEditor
      canEdit={canEdit}
      username={username}
      doc={doc}
      provider={provider}
    />
  );
}

function BlockNoteEditor({ doc, provider, canEdit, username }: YjsEditorProps) {
  // const { mutate: updateNotesMutation } =
  //   api.document.updateNotes.useMutation();

  // const { data, error, isError } = api.document.getNotesData.useQuery(
  //   {
  //     docId: query?.docId as string,
  //   },
  //   {
  //     enabled: !!query?.docId,
  //     retry: false,
  //   },
  // );

  // const debounced = useDebouncedCallback((value) => {
  //   updateNotesMutation({
  //     markdown: value,
  //     documentId: query?.docId as string,
  //   });
  // }, 3000);

  const { setEditor } = useBlocknoteEditorStore();

  const { complete, completion, isLoading, stop } = useCompletion({
    onFinish: (_prompt, completion) => {
      // select the text that was just inserted
      // editor?._tiptapEditor.commands.setTextSelection({
      //   from: editor._tiptapEditor.state.selection.from - completion.length,
      //   to: editor._tiptapEditor.state.selection.from,
      // });

      editor._tiptapEditor.commands.focus("end");
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: "Something went wrong with text generation",
        variant: "destructive",
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
  //   // @ts-ignore
  //   execute: generateAiContent,
  //   aliases: ["ai", "fill"],
  //   group: "AI",
  //   icon: <Bot size={24} />,
  //   hint: "Continue your idea with some extra inspiration!",
  // };

  const editor = useCreateBlockNote(
    {
      // onEditorContentChange: (editor) => {
      //   debounced(JSON.stringify(editor.topLevelBlocks, null, 2));
      // },
      schema,
      ...(isDev
        ? {}
        : {
            collaboration: {
              provider,
              fragment: doc.getXmlFragment("document-store"),
              user: {
                name: username || "User",
                color: getRandomLightColor(),
              },
            },
          }),

      // todo replace this with our storage
      uploadFile: uploadToTmpFilesDotOrg_DEV_ONLY,
      domAttributes: {
        editor: {
          class: "my-6",
        },
      },
    },
    [],
  );

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
      const blockText = (await editor.blocksToMarkdownLossy([block])).trim();

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

  // useEffect(() => {
  //   if (!rect) return;

  //   const handleScroll = () => {
  //     console.log("SCROLLINN");

  //     const blockDiv = document.querySelector(
  //       `div[data-id="${rect.blockId}"]`,
  //     ) as HTMLElement;

  //     if (!blockDiv) return;

  //     const newRect = blockDiv.getBoundingClientRect();

  //     setRect((prev) => {
  //       if (!prev) return null;
  //       return {
  //         ...prev,
  //         top: newRect.top + newRect.height,
  //         left: newRect.left,
  //         width: newRect.width,
  //       };
  //     });
  //   };

  //   editor.domElement.addEventListener("scroll", handleScroll);

  //   return () => {
  //     editor.domElement.removeEventListener("scroll", handleScroll);
  //   };
  // }, []);
  return (
    <div>
      <BlockNoteView
        // ref={editorRef}
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

              <ImageCaptionButton key={"imageCaptionButton"} />
              <ReplaceImageButton key={"replaceImageButton"} />

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
                  <DragHandleMenuItem
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

                      const text = await editor.blocksToMarkdownLossy([
                        props.block,
                      ]);

                      setRect({
                        top,
                        left,
                        width,
                        blockId: props.block.id,
                        text,
                      });
                    }}
                  >
                    AI
                  </DragHandleMenuItem>

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

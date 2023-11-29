import {
  BlockNoteView,
  FormattingToolbarPositioner,
  DefaultFormattingToolbar,
  HyperlinkToolbarPositioner,
  SlashMenuPositioner,
  SideMenuPositioner,
  ImageToolbarPositioner,
  useBlockNote,
} from "@blocknote/react";
import { uploadToTmpFilesDotOrg_DEV_ONLY } from "@blocknote/core";
import { useBlocknoteEditorStore } from "@/lib/store";
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import LiveblocksProvider from "@liveblocks/yjs";
import { useRoom } from "liveblocks.config";
import { getRandomLightColor } from "@/lib/utils";
import { useCompletion } from "ai/react";
import { toast } from "@/components/ui/use-toast";
import {
  blockTypeDropdownItems,
  schemaWithCustomBlocks,
  slashMenuItems,
} from "@/lib/editor-utils";
import { YjsEditorProps } from "@/types/editor";
// import { useDebouncedCallback } from "use-debounce";

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
      // editor?.commands.setTextSelection({
      //   from: editor.state.selection.from - completion.length,
      //   to: editor.state.selection.from,
      // });
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

  const editor = useBlockNote(
    {
      // initialContent: data?.initialNotes
      //   ? JSON.parse(data.initialNotes)
      //   : undefined,
      // onEditorContentChange: (editor) => {
      //   debounced(JSON.stringify(editor.topLevelBlocks, null, 2));
      // },

      editable: canEdit,
      collaboration: {
        provider,
        fragment: doc.getXmlFragment("document-store"),
        user: {
          name: username || "User",
          color: getRandomLightColor(),
        },
      },

      onEditorReady: (editor) => {
        setEditor(editor);
      },
      onEditorContentChange: async (editor) => {
        const block = editor.getTextCursorPosition().block;

        const blockText = (await editor.blocksToMarkdown([block])).trim();
        const lastTwo = blockText?.slice(-2);

        if (lastTwo === "++" && !isLoading) {
          block.content?.splice(-2, 2);

          editor.updateBlock(block, {
            id: block.id,
            content: blockText?.slice(0, -2),
          });

          complete(blockText?.slice(-500) ?? "");
        }
      },
      blockSchema: schemaWithCustomBlocks,
      // todo replace this with our storage
      uploadFile: uploadToTmpFilesDotOrg_DEV_ONLY,
      domAttributes: {
        editor: {
          class: "my-6",
        },
      },
      slashMenuItems,
    },
    [canEdit],
  );

  const prev = useRef("");

  useEffect(() => {
    if (!editor || !editor.ready) return;

    const streamCompletion = async () => {
      const diff = completion?.slice(prev.current.length);
      prev.current = completion;

      const block = editor.getTextCursorPosition().block;
      const blockText = (await editor.blocksToMarkdown([block])).trim();

      editor.updateBlock(editor.getTextCursorPosition().block, {
        id: editor.getTextCursorPosition().block.id,
        content: blockText + " " + diff,
      });
    };

    streamCompletion();
  }, [isLoading, editor, completion]);

  // add once text selection is available

  // useEffect(() => {
  //   if (!editor || !editor.ready) return;

  //   // if user presses escape or cmd + z and it's loading,
  //   // stop the request, delete the completion, and insert back the "++"
  //   const onKeyDown = (e: KeyboardEvent) => {
  //     if (e.key === "Escape" || (e.metaKey && e.key === "z")) {
  //       stop();
  //       if (e.key === "Escape") {
  //         // editor?.commands.deleteRange({
  //         //   from: editor.state.selection.from - completion.length,
  //         //   to: editor.state.selection.from,
  //         // });
  //       }
  //       // editor?.commands.insertContent("++");
  //     }
  //   };
  //   const mousedownHandler = (e: MouseEvent) => {
  //     e.preventDefault();
  //     e.stopPropagation();
  //     stop();
  //     if (window.confirm("AI writing paused. Continue?")) {
  //       // complete(editor?.getText() || "");
  //     }
  //   };
  //   if (isLoading) {
  //     document.addEventListener("keydown", onKeyDown);
  //     window.addEventListener("mousedown", mousedownHandler);
  //   } else {
  //     document.removeEventListener("keydown", onKeyDown);
  //     window.removeEventListener("mousedown", mousedownHandler);
  //   }
  //   return () => {
  //     document.removeEventListener("keydown", onKeyDown);
  //     window.removeEventListener("mousedown", mousedownHandler);
  //   };
  // }, [stop, isLoading, editor, complete, completion.length]);

  if (editor.ready) {
    return (
      <BlockNoteView className="w-full flex-1" theme={"light"} editor={editor}>
        <FormattingToolbarPositioner
          editor={editor}
          formattingToolbar={(props) => (
            <DefaultFormattingToolbar
              {...props}
              blockTypeDropdownItems={blockTypeDropdownItems}
            />
          )}
        />
        <HyperlinkToolbarPositioner editor={editor} />
        <SlashMenuPositioner editor={editor} />
        <SideMenuPositioner editor={editor} />
        <ImageToolbarPositioner editor={editor} />
      </BlockNoteView>
    );
  }
  return <></>;
}

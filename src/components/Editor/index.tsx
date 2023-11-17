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
import { defaultBlockSchema } from "@blocknote/core";
import {
  createAlertBlock,
  insertAlert,
} from "@/components/Editor/CustomBlocks/Alert";
import { createHighlightBlock } from "@/components/Editor/CustomBlocks/Highlight";
// import { useDebouncedCallback } from "use-debounce";
import { useBlocknoteEditorStore } from "@/lib/store";
import { useEffect, useState } from "react";
import * as Y from "yjs";
import LiveblocksProvider from "@liveblocks/yjs";
import { useRoom } from "liveblocks.config";
import { getRandomLightColor } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

type EditorProps = {
  doc: Y.Doc;
  provider: any;
  canEdit: boolean;
  username: string;
};

export default function Editor({
  canEdit,
  username,
}: {
  canEdit: boolean;
  username: string;
}) {
  const room = useRoom();
  // console.log(room.getOthers(), "presence");
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

const schemaWithCustomBlocks = {
  ...defaultBlockSchema,
  alert: createAlertBlock(),
  highlight: createHighlightBlock(),
};

function BlockNoteEditor({ doc, provider, canEdit, username }: EditorProps) {
  // const { mutate: updateNotesMutation } =
  //   api.document.updateNotes.useMutation();

  // username, can user see the post,can user edit the post, initial note,
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

  const editor = useBlockNote(
    {
      // initialContent: data?.initialNotes
      //   ? JSON.parse(data.initialNotes)
      //   : undefined,
      // onEditorContentChange: (editor) => {
      //   debounced(JSON.stringify(editor.topLevelBlocks, null, 2));
      // },

      // initialContent: [
      //   {
      //     id: "b8847f8b-e06a-4ad3-a27d-47b581e222ad",
      //     type: "paragraph",
      //     props: {
      //       textColor: "default",
      //       backgroundColor: "default",
      //       textAlignment: "left",
      //     },
      //     content: [],
      //     children: [],
      //   },
      // ],

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
      blockSchema: schemaWithCustomBlocks,
      // todo replace this with our storage
      uploadFile: uploadToTmpFilesDotOrg_DEV_ONLY,
      domAttributes: {
        editor: {
          class: "my-6",
        },
      },

      slashMenuItems: [
        ...getDefaultReactSlashMenuItems(schemaWithCustomBlocks),
        insertAlert,
      ],
    },
    [canEdit],
  );

  // if (isError) {
  //   if (error?.data?.code === "UNAUTHORIZED") {
  //     push("/f");

  //     toast({
  //       title: "Unauthorized",
  //       description: error.message,
  //       variant: "destructive",
  //       duration: 4000,
  //     });
  //   }
  //   return;
  // }

  if (editor.ready) {
    return (
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
    );
  }
  return <></>;
}

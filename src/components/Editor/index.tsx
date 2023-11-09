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
import { useEffect, useState } from "react";
import * as Y from "yjs";
import LiveblocksProvider from "@liveblocks/yjs";
import { useRoom } from "liveblocks.config";
import { getRandomColor } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

type EditorProps = {
  doc: Y.Doc;
  provider: any;
};

export default function Editor() {
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

  return <BlockNoteEditor doc={doc} provider={provider} />;
}

const schemaWithCustomBlocks = {
  ...defaultBlockSchema,
  alert: createAlertBlock(),
  highlight: createHighlightBlock(),
};

function BlockNoteEditor({ doc, provider }: EditorProps) {
  const { query, push } = useRouter();
  const { mutate: updateNotesMutation } =
    api.document.updateNotes.useMutation();

  // username, can user see the post,can user edit the post, initial note,
  const { data, error, isError } = api.document.getNotesData.useQuery(
    {
      docId: query?.docId as string,
    },
    {
      enabled: !!query?.docId,
      retry: false,
    },
  );

  const debounced = useDebouncedCallback((value) => {
    updateNotesMutation({
      markdown: value,
      documentId: query?.docId as string,
    });
  }, 3000);

  const { setEditor } = useBlocknoteEditorStore();

  const editor = useBlockNote(
    {
      initialContent: data?.initialNotes
        ? JSON.parse(data.initialNotes)
        : undefined,
      onEditorContentChange: (editor) => {
        debounced(JSON.stringify(editor.topLevelBlocks, null, 2));
      },
      editable: data?.canEdit,

      collaboration: {
        provider,
        fragment: doc.getXmlFragment("document-store"),
        user: {
          name: data?.username || "User",
          color: getRandomColor(),
        },
      },

      onEditorReady: (editor) => {
        setEditor(editor);
      },
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
      ],
    },
    [data?.initialNotes],
  );

  if (isError) {
    if (error?.data?.code === "UNAUTHORIZED") {
      push("/f");

      toast({
        title: "Unauthorized",
        description: error.message,
        variant: "destructive",
        duration: 4000,
      });
    }
    return;
  }

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

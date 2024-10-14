import Chat from "@/components/chat";
import BlockNoteEditor from "@/components/editor";
import Flashcards from "@/components/flashcard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomTooltip } from "@/components/ui/tooltip";
import { useBlocknoteEditorStore } from "@/lib/store";
import { saveAs } from "file-saver";
import {
  AlbumIcon,
  BugIcon,
  Download,
  Layers,
  MessagesSquareIcon,
} from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { useMemo } from "react";
import InviteCollab from "./invite-collab-modal";

const TABS = [
  {
    value: "notes",
    tooltip: "Take notes",
    icon: <AlbumIcon size={20} />,
    isNew: false,
  },
  {
    value: "chat",
    tooltip: "Chat with the pdf",
    icon: <MessagesSquareIcon size={20} />,
    isNew: false,
  },
  {
    value: "flashcards",
    tooltip: "Generate flashcards from the pdf",
    icon: <Layers size={20} />,
    isNew: false,
  },
];

const TAB_NAMES = TABS.map((tab) => tab.value);
const DEFAULT_TAB_NAME = "notes";

const Sidebar = ({
  canEdit,
  isOwner,
  isVectorised,
  note,
}: {
  canEdit: boolean;
  isOwner: boolean;
  isVectorised: boolean;
  note: string | null;
}) => {
  const { editor } = useBlocknoteEditorStore();

  const handleDownloadMarkdownAsFile = async () => {
    if (!editor) return;
    const markdownContent = await editor.blocksToMarkdownLossy(editor.document);

    const blob = new Blob([markdownContent], { type: "text/markdown" });
    saveAs(blob, "notes.md");
  };

  const TAB_CONTENTS = useMemo(
    () => [
      {
        value: "notes",
        tw: "flex-1 pb-0 break-words border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg h-full w-full overflow-scroll",
        children: <BlockNoteEditor canEdit={canEdit} note={note} />,
      },
      {
        value: "chat",
        tw: "p-2 pb-0 break-words border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg h-full w-full overflow-scroll",
        children: <Chat isVectorised={isVectorised} />,
      },
      {
        value: "flashcards",
        tw: "p-2 pb-0 break-words border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg h-full w-full overflow-scroll",
        children: <Flashcards />,
      },
    ],
    [canEdit, isVectorised],
  );

  const [activeIndex, setActiveIndex] = useQueryState("tab", {
    defaultValue: DEFAULT_TAB_NAME,
    parse: (value) => (TAB_NAMES.includes(value) ? value : DEFAULT_TAB_NAME),
  });

  return (
    <div className="bg-gray-50 h-full">
      <Tabs
        value={activeIndex}
        onValueChange={(value) => {
          setActiveIndex(value);
        }}
        defaultValue="notes"
        className="max-hd-screen flex flex-col max-w-full overflow-hidden h-full"
      >
        <div className="flex items-center justify-between pr-1">
          <TabsList className="h-12 rounded-md bg-gray-200">
            {TABS.map((item) => (
              <CustomTooltip content={item.tooltip} key={item.value}>
                <TabsTrigger value={item.value} className="relative">
                  {item.isNew && (
                    <div className="absolute -bottom-2 -right-2">
                      <Badge className="bg-blue-400 p-[0.05rem] text-[0.5rem] hover:bg-blue-500">
                        NEW
                      </Badge>
                    </div>
                  )}
                  {item.icon}
                </TabsTrigger>
              </CustomTooltip>
            ))}
          </TabsList>
          <div className="flex items-center gap-1">
            {isOwner && (
              <CustomTooltip content="Invite collaborators">
                <InviteCollab />
              </CustomTooltip>
            )}

            <CustomTooltip content="Download notes as markdown">
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto cursor-pointer border-stone-200 bg-white px-2 text-xs shadow-sm sm:border"
                onClick={handleDownloadMarkdownAsFile}
              >
                <Download size={20} />
              </Button>
            </CustomTooltip>

            <CustomTooltip content="Report bug">
              <Link href="/feedback">
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto cursor-pointer border-stone-200 bg-white px-2 text-xs shadow-sm sm:border"
                >
                  <BugIcon size={20} />
                </Button>
              </Link>
            </CustomTooltip>
          </div>
        </div>

        {TAB_CONTENTS.map((item) => (
          <TabsContent
            key={item.value}
            forceMount
            hidden={item.value !== activeIndex}
            value={item.value}
            className={item.tw}
          >
            {item.children}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
export default Sidebar;

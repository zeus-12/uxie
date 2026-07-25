import DemoChat from "@/components/demo/demo-chat";
import DemoFlashcards from "@/components/demo/demo-flashcards";
import BlockNoteEditor from "@/components/editor";
import { Button } from "@uxie/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@uxie/shared/components/ui/tabs";
import { CustomTooltip } from "@uxie/shared/components/ui/tooltip";
import { useDemoDocStore } from "@/lib/demo/store";
import { useBlocknoteEditorStore } from "@/lib/store";
import { saveAs } from "file-saver";
import { AlbumIcon, Download, Layers, MessagesSquareIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";

const TABS = [
  { value: "notes", tooltip: "Take notes", icon: <AlbumIcon size={20} /> },
  {
    value: "chat",
    tooltip: "Chat with the pdf",
    icon: <MessagesSquareIcon size={20} />,
  },
  {
    value: "flashcards",
    tooltip: "Generate flashcards from the pdf",
    icon: <Layers size={20} />,
  },
];

const TAB_NAMES = TABS.map((tab) => tab.value);
const DEFAULT_TAB_NAME = "notes";

const DemoSidebar = () => {
  const setNote = useDemoDocStore((s) => s.setNote);
  // Snapshot the note once for the editor's initial content. Reading it
  // reactively would recreate the editor on every autosave (it lives in a
  // useMemo keyed on `note`), tearing down the editor mid-typing.
  const [initialNote] = useState(() => useDemoDocStore.getState().note);
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
        tw: "flex-1 pb-0 break-words border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg h-full w-full overflow-auto",
        children: (
          <BlockNoteEditor
            canEdit
            note={initialNote}
            enableAi={false}
            onSave={setNote}
          />
        ),
      },
      {
        value: "chat",
        tw: "p-2 pb-0 break-words border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg h-full w-full overflow-auto",
        children: <DemoChat />,
      },
      {
        value: "flashcards",
        tw: "p-2 pb-0 break-words border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg h-full w-full overflow-auto",
        children: <DemoFlashcards />,
      },
    ],
    [initialNote, setNote],
  );

  const [activeIndex, setActiveIndex] = useQueryState("tab", {
    defaultValue: DEFAULT_TAB_NAME,
    parse: (value) => (TAB_NAMES.includes(value) ? value : DEFAULT_TAB_NAME),
  });

  return (
    <div className="h-full bg-gray-50">
      <Tabs
        value={activeIndex}
        onValueChange={(value) => setActiveIndex(value)}
        defaultValue="notes"
        className="max-hd-screen flex h-full max-w-full flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-2 md:pl-0 md:pr-1">
          <TabsList className="h-12 rounded-md bg-gray-200">
            {TABS.map((item) => (
              <CustomTooltip content={item.tooltip} key={item.value}>
                <TabsTrigger value={item.value} className="relative">
                  {item.icon}
                </TabsTrigger>
              </CustomTooltip>
            ))}
          </TabsList>
          <div className="flex items-center gap-1">
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

export default DemoSidebar;

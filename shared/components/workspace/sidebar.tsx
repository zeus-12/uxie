import { AlbumIcon, Layers, MessagesSquareIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useSidebarTabStore } from "../../lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CustomTooltip } from "../ui/tooltip";

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

const CONTENT_TW =
  "mt-0 break-words border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg h-full w-full overflow-auto";

export function SidebarTabs({ className }: { className?: string }) {
  const tab = useSidebarTabStore((s) => s.tab);
  const setTab = useSidebarTabStore((s) => s.setTab);

  return (
    <Tabs value={tab} onValueChange={setTab} className={className}>
      <TabsList className="h-9 rounded-md bg-gray-200">
        {TABS.map((item) => (
          <CustomTooltip content={item.tooltip} key={item.value}>
            <TabsTrigger value={item.value} className="relative px-2.5 py-1">
              {item.icon}
            </TabsTrigger>
          </CustomTooltip>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function Sidebar({
  notes,
  chat,
  flashcards,
  defaultTab = "notes",
}: {
  notes: ReactNode;
  chat: ReactNode;
  flashcards: ReactNode;
  defaultTab?: string;
}) {
  const tab = useSidebarTabStore((s) => s.tab);
  const setTab = useSidebarTabStore((s) => s.setTab);

  useEffect(() => {
    setTab(defaultTab);
    // Only on mount — a new document should start on the default tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contents = [
    { value: "notes", tw: `flex-1 pb-0 ${CONTENT_TW}`, children: notes },
    { value: "chat", tw: `p-2 pb-0 ${CONTENT_TW}`, children: chat },
    { value: "flashcards", tw: `p-2 pb-0 ${CONTENT_TW}`, children: flashcards },
  ];

  return (
    <div className="h-full bg-gray-50">
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="max-hd-screen flex h-full max-w-full flex-col overflow-hidden"
      >
        {contents.map((item) => (
          <TabsContent
            key={item.value}
            forceMount
            hidden={item.value !== tab}
            value={item.value}
            className={item.tw}
          >
            {item.children}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

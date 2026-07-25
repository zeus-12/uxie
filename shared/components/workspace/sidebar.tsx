import { AlbumIcon, Layers, MessagesSquareIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { DEFAULT_SIDEBAR_TAB, useSidebarTabStore, type SidebarTab } from "../../lib/store";
import { cn } from "../../lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CustomTooltip } from "../ui/tooltip";

const TABS: { value: SidebarTab; tooltip: string; icon: ReactNode }[] = [
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
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as SidebarTab)}
      className={className}
    >
      <TabsList className="h-9 rounded-md bg-gray-200">
        {TABS.map((item) => (
          <CustomTooltip content={item.tooltip} key={item.value}>
            <TabsTrigger
              value={item.value}
              className="relative px-2.5 py-1 text-muted-foreground transition-all duration-150 hover:bg-white/60 hover:text-foreground active:scale-95 data-[state=active]:text-foreground"
            >
              {item.icon}
            </TabsTrigger>
          </CustomTooltip>
        ))}
      </TabsList>
    </Tabs>
  );
}

// The tab strip plus whatever actions the app puts on the right. The fixed
// height is what gives the panel below it some breathing room.
export function SidebarHeader({
  className,
  tabsClassName,
  children,
}: {
  className?: string;
  tabsClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex h-12 shrink-0 items-center px-2", className)}>
      <SidebarTabs className={tabsClassName} />
      {children}
    </div>
  );
}

export function Sidebar({
  notes,
  chat,
  flashcards,
  defaultTab = DEFAULT_SIDEBAR_TAB,
  resetTabOnMount = true,
}: {
  notes: ReactNode;
  chat: ReactNode;
  flashcards: ReactNode;
  defaultTab?: SidebarTab;
  // Desktop resets to the default tab on mount (a new document starts on notes).
  // Web owns the initial tab via the URL (?tab=), so it opts out.
  resetTabOnMount?: boolean;
}) {
  const tab = useSidebarTabStore((s) => s.tab);
  const setTab = useSidebarTabStore((s) => s.setTab);

  useEffect(() => {
    if (resetTabOnMount) setTab(defaultTab);
    // Only on mount — a new document should start on the default tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contents = [
    { value: "notes", tw: `flex-1 pb-0 ${CONTENT_TW}`, children: notes },
    // Chat manages its own internal padding (ChatPanel), so it gets none here —
    // keeps its bubbles/input aligned with the tab strip.
    { value: "chat", tw: CONTENT_TW, children: chat },
    { value: "flashcards", tw: `p-2 pb-0 ${CONTENT_TW}`, children: flashcards },
  ];

  return (
    <div className="h-full bg-gray-50">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as SidebarTab)}
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

import {
  AlbumIcon,
  Layers,
  MessagesSquareIcon,
  SettingsIcon,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import {
  DEFAULT_SIDEBAR_TAB,
  SIDEBAR_TABS,
  useSidebarTabStore,
  type SidebarTab,
} from "../../lib/store";
import { cn } from "../../lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CustomTooltip } from "../ui/tooltip";

const TABS: { value: SidebarTab; tooltip: string; icon: ReactNode }[] = [
  { value: "notes", tooltip: "Take notes", icon: <AlbumIcon size={20} /> },
  {
    value: "chat",
    tooltip: "Chat with this document",
    icon: <MessagesSquareIcon size={20} />,
  },
  {
    value: "flashcards",
    tooltip: "Generate flashcards",
    icon: <Layers size={20} />,
  },
];

const CONTENT_TW =
  "mt-0 break-words border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg h-full w-full overflow-auto";

export function SidebarTabs({
  className,
  tabs = SIDEBAR_TABS,
}: {
  className?: string;
  tabs?: readonly SidebarTab[];
}) {
  return (
    <div className={className}>
      <TabsList className="h-9 rounded-md bg-gray-200">
        {TABS.filter((item) => tabs.includes(item.value)).map((item) => (
          <CustomTooltip content={item.tooltip} key={item.value} asChild>
            {/* Keep Tooltip's data-state on this wrapper. Putting both Radix
                triggers on the button makes Tooltip overwrite Tabs' active
                state, which removes the selected styling. */}
            <span className="inline-flex">
              <TabsTrigger
                value={item.value}
                aria-label={item.tooltip}
                className="relative px-2.5 py-1 text-muted-foreground transition-all duration-150 hover:bg-white/60 hover:text-foreground active:scale-95 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {item.icon}
              </TabsTrigger>
            </span>
          </CustomTooltip>
        ))}
      </TabsList>
    </div>
  );
}

// The tab strip plus whatever actions the app puts on the right. The fixed
// height is what gives the panel below it some breathing room.
export function SidebarHeader({
  className,
  tabsClassName,
  tabs,
  children,
}: {
  className?: string;
  tabsClassName?: string;
  tabs?: readonly SidebarTab[];
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex h-12 shrink-0 items-center px-2", className)}>
      <SidebarTabs className={tabsClassName} tabs={tabs} />
      {children}
    </div>
  );
}

// The gear on the right of the header. Desktop wires it straight to onClick,
// web and the demo wrap it in a dropdown — so it stays a plain forwardRef
// button that Radix can use as `asChild`.
export const SidebarSettingsButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button">
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label="Document options"
    className={cn(
      "ml-auto rounded-md p-1.5 text-muted-foreground transition-all duration-150 hover:bg-gray-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-90",
      className,
    )}
    {...props}
  >
    <SettingsIcon
      aria-hidden="true"
      size={18}
      className="transition-transform duration-300 hover:rotate-45"
    />
  </button>
));
SidebarSettingsButton.displayName = "SidebarSettingsButton";

export function Sidebar({
  notes,
  chat,
  flashcards,
  headerActions,
  headerClassName,
  tabsClassName,
  defaultTab = DEFAULT_SIDEBAR_TAB,
  resetTabOnMount = true,
  tabs = SIDEBAR_TABS,
}: {
  notes: ReactNode;
  chat: ReactNode;
  flashcards: ReactNode;
  headerActions?: ReactNode;
  headerClassName?: string;
  tabsClassName?: string;
  defaultTab?: SidebarTab;
  // Desktop resets to the default tab on mount (a new document starts on notes).
  // Web owns the initial tab via the URL (?tab=), so it opts out.
  resetTabOnMount?: boolean;
  tabs?: readonly SidebarTab[];
}) {
  const tab = useSidebarTabStore((s) => s.tab);
  const setTab = useSidebarTabStore((s) => s.setTab);

  useEffect(() => {
    if (resetTabOnMount) setTab(defaultTab);
    // Only on mount — a new document should start on the default tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tabs.includes(tab)) setTab(defaultTab);
  }, [defaultTab, setTab, tab, tabs]);

  const contents = [
    { value: "notes", tw: `flex-1 pb-0 ${CONTENT_TW}`, children: notes },
    // Chat manages its own internal padding (ChatPanel), so it gets none here —
    // keeps its bubbles/input aligned with the tab strip.
    { value: "chat", tw: CONTENT_TW, children: chat },
    { value: "flashcards", tw: `p-2 pb-0 ${CONTENT_TW}`, children: flashcards },
  ].filter((item) => tabs.includes(item.value as SidebarTab));

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as SidebarTab)}
      className="max-hd-screen flex h-full max-w-full flex-col overflow-hidden bg-gray-50"
    >
      <SidebarHeader
        className={headerClassName}
        tabsClassName={tabsClassName}
        tabs={tabs}
      >
        {headerActions}
      </SidebarHeader>
      <div className="min-h-0 flex-1">
        <div className="h-full">
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
        </div>
      </div>
    </Tabs>
  );
}

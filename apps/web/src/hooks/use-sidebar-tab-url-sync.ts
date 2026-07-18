import {
  DEFAULT_SIDEBAR_TAB,
  SIDEBAR_TABS,
  useSidebarTabStore,
  type SidebarTab,
} from "@uxie/shared/lib/store";
import { useQueryState } from "nuqs";
import { useEffect } from "react";

const isSidebarTab = (v: string): v is SidebarTab =>
  (SIDEBAR_TABS as readonly string[]).includes(v);

// The shared sidebar drives tab state through the zustand store, but web keeps
// the active tab in the URL (?tab=) for deep links + back/forward. This bridges
// both directions: the URL is the source of truth on mount / navigation, and
// store-driven controls (tab clicks, ⌘1/2/3, the highlight popover) write back
// to the address bar. Web-only — desktop has no URL and doesn't use this.
export function useSidebarTabUrlSync() {
  const tab = useSidebarTabStore((s) => s.tab);
  const setTab = useSidebarTabStore((s) => s.setTab);
  const [urlTab, setUrlTab] = useQueryState("tab", {
    defaultValue: DEFAULT_SIDEBAR_TAB,
    parse: (v): SidebarTab => (isSidebarTab(v) ? v : DEFAULT_SIDEBAR_TAB),
  });

  // URL -> store (mount + browser navigation).
  useEffect(() => {
    if (urlTab !== tab) setTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  // store -> URL (tab clicks, shortcuts, popover).
  useEffect(() => {
    if (tab !== urlTab) void setUrlTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
}

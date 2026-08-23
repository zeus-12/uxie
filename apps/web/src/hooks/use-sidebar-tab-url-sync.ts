import {
  DEFAULT_SIDEBAR_TAB,
  SIDEBAR_TABS,
  useSidebarTabStore,
  type SidebarTab,
} from "@uxie/shared/lib/store";
import { useQueryState } from "nuqs";
import { useEffect, useRef } from "react";

const isSidebarTab = (v: string): v is SidebarTab =>
  (SIDEBAR_TABS as readonly string[]).includes(v);

// The shared sidebar drives tab state through the zustand store, but web keeps
// the active tab in the URL (?tab=) for deep links + back/forward. This bridges
// both directions: the URL is the source of truth on mount / navigation, and
// store-driven controls (tab clicks, ⌘1/2/3, the highlight popover) write back
// to the address bar. Web-only — desktop has no URL and doesn't use this.
export function useSidebarTabUrlSync() {
  const setTab = useSidebarTabStore((s) => s.setTab);
  const [urlTab, setUrlTab] = useQueryState("tab", {
    defaultValue: DEFAULT_SIDEBAR_TAB,
    parse: (v): SidebarTab => (isSidebarTab(v) ? v : DEFAULT_SIDEBAR_TAB),
  });
  const urlTabRef = useRef(urlTab);

  // URL -> store (mount + browser navigation). Update the ref before the
  // store so the subscription below knows this change came from the URL.
  useEffect(() => {
    urlTabRef.current = urlTab;
    if (useSidebarTabStore.getState().tab !== urlTab) setTab(urlTab);
  }, [setTab, urlTab]);

  // Store -> URL (tab clicks, shortcuts, popover). A subscription avoids the
  // stale-render race where the persisted store value could overwrite a fresh
  // deep link before the URL -> store effect finished.
  useEffect(() => {
    return useSidebarTabStore.subscribe((state) => {
      if (state.tab === urlTabRef.current) return;
      urlTabRef.current = state.tab;
      void setUrlTab(state.tab);
    });
  }, [setUrlTab]);
}

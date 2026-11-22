import { useSidebarTabUrlSync } from "@/hooks/use-sidebar-tab-url-sync";
import {
  Sidebar,
  SidebarSettingsButton,
} from "@uxie/shared/components/workspace/sidebar";
import { useSidebarTabStore } from "@uxie/shared/lib/store";
import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const urlState = vi.hoisted(() => ({
  tab: "notes",
  setTab: vi.fn(),
}));

vi.mock("nuqs", () => ({
  useQueryState: () => [urlState.tab, urlState.setTab],
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  urlState.tab = "notes";
  urlState.setTab.mockReset();
  useSidebarTabStore.getState().setTab("notes");
});

afterEach(() => {
  if (root) flushSync(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function renderSidebar(
  onSettings = vi.fn(),
  tabs?: readonly ("notes" | "chat" | "flashcards")[],
) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(
    () =>
      root?.render(
        React.createElement(Sidebar, {
          notes: React.createElement("div", null, "Notes panel"),
          chat: React.createElement("div", null, "Chat panel"),
          flashcards: React.createElement("div", null, "Flashcards panel"),
          headerActions: React.createElement(SidebarSettingsButton, {
            onClick: onSettings,
          }),
          resetTabOnMount: false,
          tabs,
        }),
      ),
  );
  return { onSettings };
}

describe("shared reader sidebar header", () => {
  it("renders one named button per tab without nesting buttons", () => {
    renderSidebar();

    const tabs = Array.from(
      container!.querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
    );
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "Take notes",
      "Chat with this document",
      "Generate flashcards",
    ]);
    expect(container!.querySelector("button button")).toBeNull();
  });

  it("can omit flashcards for article readers", () => {
    renderSidebar(vi.fn(), ["notes", "chat"]);

    const tabs = Array.from(
      container!.querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
    );
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "Take notes",
      "Chat with this document",
    ]);
    expect(container!.textContent).not.toContain("Flashcards panel");
  });

  it("switches the shared tab state", () => {
    renderSidebar();

    const chat = container!.querySelector<HTMLButtonElement>(
      'button[aria-label="Chat with this document"]',
    )!;
    flushSync(() =>
      chat.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          button: 0,
          ctrlKey: false,
        }),
      ),
    );
    expect(useSidebarTabStore.getState().tab).toBe("chat");
    expect(chat.getAttribute("data-state")).toBe("active");
    expect(chat.getAttribute("aria-selected")).toBe("true");
  });

  it("connects every tab to its panel in one tab root", () => {
    renderSidebar();

    const tabs = Array.from(
      container!.querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
    );
    expect(tabs).toHaveLength(3);
    for (const tab of tabs) {
      const controls = tab.getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      expect(
        container!.querySelector(`#${CSS.escape(controls!)}`),
      ).not.toBeNull();
    }
  });

  it("exposes document options as a non-submit button", () => {
    const onSettings = vi.fn();
    renderSidebar(onSettings);

    const settings = container!.querySelector<HTMLButtonElement>(
      'button[aria-label="Document options"]',
    );
    expect(settings?.type).toBe("button");
    settings?.click();
    expect(onSettings).toHaveBeenCalledOnce();
  });
});

describe("web sidebar URL sync", () => {
  it("lets the URL win on mount without writing stale persisted state back", async () => {
    useSidebarTabStore.getState().setTab("flashcards");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    function SyncHarness() {
      useSidebarTabUrlSync();
      return null;
    }

    flushSync(() => root?.render(React.createElement(SyncHarness)));

    await vi.waitFor(() => {
      expect(useSidebarTabStore.getState().tab).toBe("notes");
    });
    expect(urlState.setTab).not.toHaveBeenCalledWith("flashcards");
  });
});

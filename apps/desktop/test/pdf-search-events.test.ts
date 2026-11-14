import { describe, expect, it, vi } from "vitest";
import type { EventBus } from "pdfjs-dist/types/web/event_utils";
import {
  clearFindResults,
  dispatchFindRequest,
  hasNativeSearchableText,
  readNativeFindUpdate,
  updateMatchCount,
} from "../src/renderer/pdf-search-events";

describe("desktop PDF search events", () => {
  it("dispatches the native PDF.js find contract", () => {
    const dispatch = vi.fn();
    const eventBus = { dispatch } as unknown as EventBus;
    const source = {};

    dispatchFindRequest({
      eventBus,
      source,
      query: "reader search",
      direction: "previous",
      type: "again",
    });

    expect(dispatch).toHaveBeenCalledWith("find", {
      source,
      type: "again",
      query: "reader search",
      phraseSearch: true,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: true,
      matchDiacritics: false,
    });
  });

  it("clears native highlights when search closes", () => {
    const dispatch = vi.fn();
    const eventBus = { dispatch } as unknown as EventBus;
    const source = {};

    clearFindResults({ eventBus, source });

    expect(dispatch).toHaveBeenCalledWith("findbarclose", { source });
  });

  it("distinguishes no matches from a PDF with no searchable text", () => {
    const payload = {
      state: 1,
      matchesCount: { current: 0, total: 0 },
    };

    expect(
      readNativeFindUpdate({
        eventName: "updatefindcontrolstate",
        payload,
        hasSearchableText: true,
      }),
    ).toEqual({ kind: "control-state", status: { kind: "not-found" } });
    expect(
      readNativeFindUpdate({
        eventName: "updatefindcontrolstate",
        payload,
        hasSearchableText: false,
      }),
    ).toEqual({ kind: "control-state", status: { kind: "no-text" } });
  });

  it("reads PDF.js's already-extracted page text without extracting it again", () => {
    expect(hasNativeSearchableText({ _pageContents: ["", "Text"] })).toBe(true);
    expect(hasNativeSearchableText({ _pageContents: ["", "  "] })).toBe(false);
    expect(hasNativeSearchableText({})).toBeNull();
  });

  it("keeps progressive totals while PDF.js searches the whole document", () => {
    expect(
      updateMatchCount(
        { kind: "searching", matches: { current: 0, total: 0 } },
        { current: 1, total: 4 },
      ),
    ).toEqual({ kind: "searching", matches: { current: 1, total: 4 } });
  });

  it("ignores malformed event-bus payloads", () => {
    expect(
      readNativeFindUpdate({
        eventName: "updatefindcontrolstate",
        payload: { state: 0, matchesCount: { current: -1, total: "2" } },
        hasSearchableText: true,
      }),
    ).toBeNull();
  });
});

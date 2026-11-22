import { describe, expect, it, vi } from "vitest";
import type { EventBus } from "pdfjs-dist/types/web/event_utils";
import {
  clearFind,
  dispatchFind,
  readFindControlState,
  readMatchCount,
  withMatchCount,
} from "@uxie/shared/lib/pdf-search";

const FOUND = 0;
const NOT_FOUND = 1;
const WRAPPED = 2;
const PENDING = 3;

const controlState = (
  state: number,
  rawQuery: string,
  current = 1,
  total = 3,
) => ({
  state,
  rawQuery,
  matchesCount: { current, total },
});

describe("PDF search over the pdf.js find event bus", () => {
  it("dispatches pdf.js's find contract", () => {
    const dispatch = vi.fn();
    const eventBus = { dispatch } as unknown as EventBus;
    const source = {};

    dispatchFind({
      eventBus,
      source,
      query: "reader search",
      direction: "previous",
      again: true,
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

  it("clears highlights through findbarclose", () => {
    const dispatch = vi.fn();
    const source = {};
    clearFind({ eventBus: { dispatch } as unknown as EventBus, source });
    expect(dispatch).toHaveBeenCalledWith("findbarclose", { source });
  });

  it("maps every pdf.js find state", () => {
    const matches = { current: 1, total: 3 };
    expect(readFindControlState(controlState(PENDING, "q"), "q")).toEqual({
      kind: "searching",
      matches,
    });
    expect(readFindControlState(controlState(FOUND, "q"), "q")).toEqual({
      kind: "ready",
      matches,
    });
    expect(readFindControlState(controlState(WRAPPED, "q"), "q")).toEqual({
      kind: "ready",
      matches,
    });
    expect(
      readFindControlState(controlState(NOT_FOUND, "q", 0, 0), "q"),
    ).toEqual({ kind: "not-found" });
  });

  it("ignores state reported for a query other than the current one", () => {
    expect(readFindControlState(controlState(FOUND, "old"), "new")).toBeNull();
  });

  it("ignores malformed payloads", () => {
    expect(
      readFindControlState(
        {
          state: FOUND,
          rawQuery: "q",
          matchesCount: { current: -1, total: "2" },
        },
        "q",
      ),
    ).toBeNull();
    expect(
      readFindControlState({ ...controlState(FOUND, "q"), state: 9 }, "q"),
    ).toBeNull();
    expect(readMatchCount(null)).toBeNull();
  });

  it("applies progressive totals only while a search is live", () => {
    const matches = { current: 1, total: 4 };
    expect(
      withMatchCount(
        { kind: "searching", matches: { current: 0, total: 0 } },
        matches,
      ),
    ).toEqual({
      kind: "searching",
      matches,
    });
    expect(withMatchCount({ kind: "idle" }, matches)).toEqual({ kind: "idle" });
    expect(withMatchCount({ kind: "not-found" }, matches)).toEqual({
      kind: "not-found",
    });
  });
});

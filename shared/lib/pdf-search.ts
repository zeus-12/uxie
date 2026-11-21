import type { EventBus } from "pdfjs-dist/types/web/event_utils";

export type MatchCount = {
  current: number;
  total: number;
};

export type SearchStatus =
  | { kind: "idle" }
  | { kind: "searching"; matches: MatchCount }
  | { kind: "ready"; matches: MatchCount }
  | { kind: "not-found" };

export type FindDirection = "next" | "previous";

// pdf.js 2.16.105's FindState: not exported from pdf_viewer's public entry.
const FIND_STATE = {
  FOUND: 0,
  NOT_FOUND: 1,
  WRAPPED: 2,
  PENDING: 3,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function readMatchCount(payload: unknown): MatchCount | null {
  if (!isRecord(payload) || !isRecord(payload.matchesCount)) return null;
  const { current, total } = payload.matchesCount;
  if (!isCount(current) || !isCount(total)) return null;
  return { current, total };
}

// pdf.js keeps reporting state for a query after it is replaced or closed;
// only events carrying the current query may update the UI.
export function readFindControlState(
  payload: unknown,
  query: string,
): SearchStatus | null {
  if (!isRecord(payload) || payload.rawQuery !== query) return null;
  const matches = readMatchCount(payload);
  if (!matches) return null;

  switch (payload.state) {
    case FIND_STATE.PENDING:
      return { kind: "searching", matches };
    case FIND_STATE.FOUND:
    case FIND_STATE.WRAPPED:
      return { kind: "ready", matches };
    case FIND_STATE.NOT_FOUND:
      return { kind: "not-found" };
    default:
      return null;
  }
}

export function withMatchCount(
  status: SearchStatus,
  matches: MatchCount,
): SearchStatus {
  if (status.kind === "searching" || status.kind === "ready") {
    return { ...status, matches };
  }
  return status;
}

export function dispatchFind({
  eventBus,
  source,
  query,
  direction,
  again,
}: {
  eventBus: EventBus;
  source: object;
  query: string;
  direction: FindDirection;
  again: boolean;
}) {
  eventBus.dispatch("find", {
    source,
    type: again ? "again" : "",
    query,
    phraseSearch: true,
    caseSensitive: false,
    entireWord: false,
    highlightAll: true,
    findPrevious: direction === "previous",
    matchDiacritics: false,
  });
}

export function clearFind({
  eventBus,
  source,
}: {
  eventBus: EventBus;
  source: object;
}) {
  eventBus.dispatch("findbarclose", { source });
}

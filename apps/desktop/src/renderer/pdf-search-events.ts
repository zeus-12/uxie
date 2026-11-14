import type { EventBus } from "pdfjs-dist/types/web/event_utils";

export type MatchCount = {
  current: number;
  total: number;
};

export type SearchStatus =
  | { kind: "idle" }
  | { kind: "searching"; matches: MatchCount }
  | { kind: "ready"; matches: MatchCount }
  | { kind: "not-found" }
  | { kind: "no-text" };

export type NativeFindUpdate =
  | { kind: "control-state"; status: SearchStatus }
  | { kind: "matches-count"; matches: MatchCount };

type FindDirection = "next" | "previous";
type FindRequestType = "" | "again";

// PDF.js 2.16.105's FindState values. They are not re-exported from the
// package's public TypeScript entry point, so keep the version-specific values
// at this boundary and validate every event before it enters React state.
const NATIVE_FIND_STATE = {
  FOUND: 0,
  NOT_FOUND: 1,
  WRAPPED: 2,
  PENDING: 3,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMatchCount(payload: unknown): MatchCount | null {
  if (!isRecord(payload) || !isRecord(payload.matchesCount)) return null;

  const { current, total } = payload.matchesCount;
  if (
    typeof current !== "number" ||
    !Number.isInteger(current) ||
    current < 0 ||
    typeof total !== "number" ||
    !Number.isInteger(total) ||
    total < 0
  ) {
    return null;
  }

  return { current, total };
}

export function readNativeFindUpdate({
  eventName,
  payload,
  hasSearchableText,
}: {
  eventName: "updatefindcontrolstate" | "updatefindmatchescount";
  payload: unknown;
  hasSearchableText: boolean | null;
}): NativeFindUpdate | null {
  const matches = readMatchCount(payload);
  if (!matches) return null;

  if (eventName === "updatefindmatchescount") {
    return { kind: "matches-count", matches };
  }

  if (!isRecord(payload) || typeof payload.state !== "number") return null;

  switch (payload.state) {
    case NATIVE_FIND_STATE.PENDING:
      return {
        kind: "control-state",
        status: { kind: "searching", matches },
      };
    case NATIVE_FIND_STATE.FOUND:
    case NATIVE_FIND_STATE.WRAPPED:
      return {
        kind: "control-state",
        status: { kind: "ready", matches },
      };
    case NATIVE_FIND_STATE.NOT_FOUND:
      return {
        kind: "control-state",
        status:
          hasSearchableText === false
            ? { kind: "no-text" }
            : { kind: "not-found" },
      };
    default:
      return null;
  }
}

export function updateMatchCount(
  status: SearchStatus,
  matches: MatchCount,
): SearchStatus {
  if (status.kind === "searching" || status.kind === "ready") {
    return { ...status, matches };
  }
  return status;
}

export function hasNativeSearchableText(
  findController: unknown,
): boolean | null {
  if (!isRecord(findController)) return null;

  const pageContents = findController._pageContents;
  if (!Array.isArray(pageContents)) return null;

  return pageContents.some(
    (content) => typeof content === "string" && content.trim().length > 0,
  );
}

export function dispatchFindRequest({
  eventBus,
  source,
  query,
  direction,
  type,
}: {
  eventBus: EventBus;
  source: object;
  query: string;
  direction: FindDirection;
  type: FindRequestType;
}) {
  eventBus.dispatch("find", {
    source,
    type,
    query,
    phraseSearch: true,
    caseSensitive: false,
    entireWord: false,
    highlightAll: true,
    findPrevious: direction === "previous",
    matchDiacritics: false,
  });
}

export function clearFindResults({
  eventBus,
  source,
}: {
  eventBus: EventBus;
  source: object;
}) {
  eventBus.dispatch("findbarclose", { source });
}

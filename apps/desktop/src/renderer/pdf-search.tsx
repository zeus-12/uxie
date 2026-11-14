import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import type { EventBus } from "pdfjs-dist/types/web/event_utils";
import { cn } from "@uxie/shared/lib/utils";
import {
  clearFindResults,
  dispatchFindRequest,
  hasNativeSearchableText,
  readNativeFindUpdate,
  updateMatchCount,
  type SearchStatus,
} from "./pdf-search-events";

const EMPTY_MATCHES = { current: 0, total: 0 };

function resultLabel(status: SearchStatus, hasQuery: boolean) {
  if (!hasQuery || status.kind === "idle") return "";

  switch (status.kind) {
    case "searching":
      return status.matches.total > 0
        ? `${status.matches.current} of ${status.matches.total}`
        : "Searching...";
    case "ready":
      return `${status.matches.current} of ${status.matches.total}`;
    case "not-found":
      return "No matches";
    case "no-text":
      return "No searchable text";
  }
}

function isVisibleViewer(container: HTMLElement | null) {
  if (!container || container.getClientRects().length === 0) return false;
  return getComputedStyle(container).visibility !== "hidden";
}

export function PdfSearch({
  eventBus,
  findController,
  viewerContainer,
}: {
  eventBus: EventBus | null;
  findController: unknown;
  viewerContainer: HTMLElement | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>({ kind: "idle" });
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef({ name: "uxie-pdf-search" });

  const focusAndSelectQuery = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const close = useCallback(() => {
    if (eventBus) {
      clearFindResults({ eventBus, source: sourceRef.current });
    }
    setIsOpen(false);
    setStatus({ kind: "idle" });
  }, [eventBus]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!isVisibleViewer(viewerContainer)) return;

      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();
        if (isOpen) {
          focusAndSelectQuery();
        } else {
          setIsOpen(true);
        }
        return;
      }

      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };

    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [close, focusAndSelectQuery, isOpen, viewerContainer]);

  useEffect(() => {
    if (!isOpen) return;

    focusAndSelectQuery();
  }, [focusAndSelectQuery, isOpen]);

  useEffect(() => {
    if (!eventBus) return;

    const handleControlState = (payload: unknown) => {
      const update = readNativeFindUpdate({
        eventName: "updatefindcontrolstate",
        payload,
        hasSearchableText: hasNativeSearchableText(findController),
      });
      if (update?.kind === "control-state") setStatus(update.status);
    };
    const handleMatchesCount = (payload: unknown) => {
      const update = readNativeFindUpdate({
        eventName: "updatefindmatchescount",
        payload,
        hasSearchableText: null,
      });
      if (update?.kind === "matches-count") {
        setStatus((current) => updateMatchCount(current, update.matches));
      }
    };

    eventBus.on("updatefindcontrolstate", handleControlState);
    eventBus.on("updatefindmatchescount", handleMatchesCount);
    return () => {
      eventBus.off("updatefindcontrolstate", handleControlState);
      eventBus.off("updatefindmatchescount", handleMatchesCount);
      clearFindResults({ eventBus, source: sourceRef.current });
    };
  }, [eventBus, findController]);

  useEffect(() => {
    if (!isOpen || !eventBus) return;

    if (query.length === 0) {
      setStatus({ kind: "idle" });
    } else {
      setStatus({ kind: "searching", matches: EMPTY_MATCHES });
    }

    dispatchFindRequest({
      eventBus,
      source: sourceRef.current,
      query,
      direction: "next",
      type: "",
    });
  }, [eventBus, isOpen, query]);

  const move = (direction: "next" | "previous") => {
    if (!eventBus || query.length === 0) return;

    dispatchFindRequest({
      eventBus,
      source: sourceRef.current,
      query,
      direction,
      type: "again",
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    move(event.shiftKey ? "previous" : "next");
  };

  if (!isOpen) return null;

  const label = resultLabel(status, query.length > 0);
  const controlsDisabled =
    query.length === 0 ||
    status.kind === "not-found" ||
    status.kind === "no-text";

  return (
    <form
      role="search"
      aria-label="Find in document"
      onSubmit={handleSubmit}
      className="absolute right-3 top-3 z-50 flex h-9 items-center gap-1 rounded-lg border border-stone-200 bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
    >
      <label htmlFor={inputId} className="sr-only">
        Find in document
      </label>
      <SearchIcon
        aria-hidden="true"
        className="ml-1 h-3.5 w-3.5 text-stone-400"
      />
      <input
        id={inputId}
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder="Find in document"
        autoComplete="off"
        spellCheck={false}
        className="h-7 w-36 rounded border-0 bg-transparent px-1 text-sm outline-none placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-stone-700"
      />
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "min-w-14 whitespace-nowrap px-1 text-right text-[11px] tabular-nums text-stone-500",
          label.length === 0 && "sr-only",
        )}
      >
        {label}
      </span>
      <div className="flex items-center border-l border-stone-200 pl-1">
        <button
          type="button"
          onClick={() => move("previous")}
          disabled={controlsDisabled}
          aria-label="Previous match"
          className="flex h-7 w-7 items-center justify-center rounded text-stone-600 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-700 disabled:opacity-30"
        >
          <ChevronUpIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => move("next")}
          disabled={controlsDisabled}
          aria-label="Next match"
          className="flex h-7 w-7 items-center justify-center rounded text-stone-600 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-700 disabled:opacity-30"
        >
          <ChevronDownIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Close search"
          className="flex h-7 w-7 items-center justify-center rounded text-stone-600 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-700"
        >
          <XIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}

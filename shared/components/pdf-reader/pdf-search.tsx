import {
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import type { EventBus } from "pdfjs-dist/types/web/event_utils";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  clearFind,
  dispatchFind,
  readFindControlState,
  readMatchCount,
  withMatchCount,
  type FindDirection,
  type SearchStatus,
} from "../../lib/pdf-search";
import { cn } from "../../lib/utils";

function resultLabel(status: SearchStatus) {
  switch (status.kind) {
    case "idle":
      return "";
    case "searching":
      return status.matches.total > 0
        ? `${status.matches.current} of ${status.matches.total}`
        : "Searching…";
    case "ready":
      return `${status.matches.current} of ${status.matches.total}`;
    case "not-found":
      return "No matches";
  }
}

const iconButtonClass =
  "flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30";

export function PdfSearch({
  eventBus,
  viewerContainer,
}: {
  eventBus: EventBus | null;
  viewerContainer: HTMLElement | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>({ kind: "idle" });
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef({});

  const focusQuery = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const close = useCallback(() => {
    if (eventBus) clearFind({ eventBus, source: sourceRef.current });
    setIsOpen(false);
    setStatus({ kind: "idle" });
  }, [eventBus]);

  useEffect(() => {
    if (!viewerContainer) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "f" ||
        viewerContainer.getClientRects().length === 0
      ) {
        return;
      }
      event.preventDefault();
      if (isOpen) focusQuery();
      else setIsOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusQuery, isOpen, viewerContainer]);

  useEffect(() => {
    if (isOpen) focusQuery();
  }, [focusQuery, isOpen]);

  useEffect(() => {
    if (!eventBus || !isOpen) return;
    const source = sourceRef.current;

    const handleControlState = (payload: unknown) => {
      const next = readFindControlState(payload, query);
      if (next) setStatus(next);
    };
    const handleMatchesCount = (payload: unknown) => {
      const matches = readMatchCount(payload);
      if (matches) setStatus((current) => withMatchCount(current, matches));
    };

    eventBus.on("updatefindcontrolstate", handleControlState);
    eventBus.on("updatefindmatchescount", handleMatchesCount);

    if (query.length === 0) {
      setStatus({ kind: "idle" });
      clearFind({ eventBus, source });
    } else {
      setStatus({ kind: "searching", matches: { current: 0, total: 0 } });
      dispatchFind({
        eventBus,
        source,
        query,
        direction: "next",
        again: false,
      });
    }

    return () => {
      eventBus.off("updatefindcontrolstate", handleControlState);
      eventBus.off("updatefindmatchescount", handleMatchesCount);
    };
  }, [eventBus, isOpen, query]);

  const move = (direction: FindDirection) => {
    if (!eventBus || query.length === 0) return;
    dispatchFind({
      eventBus,
      source: sourceRef.current,
      query,
      direction,
      again: true,
    });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Enter" && event.target === inputRef.current) {
      event.preventDefault();
      move(event.shiftKey ? "previous" : "next");
    }
  };

  if (!isOpen) return null;

  const label = resultLabel(status);
  const canMove = status.kind === "searching" || status.kind === "ready";

  return (
    <form
      role="search"
      aria-label="Find in document"
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={handleKeyDown}
      className="absolute right-3 top-3 z-50 flex h-9 items-center gap-1 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-[0_4px_16px_-4px_rgb(0_0_0/0.18)]"
    >
      <label htmlFor={inputId} className="sr-only">
        Find in document
      </label>
      <SearchIcon
        aria-hidden="true"
        className="ml-1 h-3.5 w-3.5 text-muted-foreground"
      />
      <input
        id={inputId}
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find in document"
        autoComplete="off"
        spellCheck={false}
        className="h-7 w-36 rounded border-0 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
      />
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "min-w-14 whitespace-nowrap px-1 text-right text-[11px] tabular-nums text-muted-foreground",
          label.length === 0 && "sr-only",
        )}
      >
        {label}
      </span>
      <div className="flex items-center border-l border-border pl-1">
        <button
          type="button"
          onClick={() => move("previous")}
          disabled={!canMove}
          aria-label="Previous match"
          className={iconButtonClass}
        >
          <ChevronUpIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => move("next")}
          disabled={!canMove}
          aria-label="Next match"
          className={iconButtonClass}
        >
          <ChevronDownIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Close search"
          className={iconButtonClass}
        >
          <XIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}

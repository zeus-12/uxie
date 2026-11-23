import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  Bookmark as BookmarkIcon,
  BookmarkCheck,
  File,
  List,
  MapPin,
  MapPinPlus,
  Pencil,
  TextQuote,
  Trash2,
} from "lucide-react";
import type { Bookmark } from "@uxie/shared/schema";
import { Button } from "@uxie/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@uxie/shared/components/ui/popover";
import { cn } from "@uxie/shared/lib/utils";

type BookmarkKind = "page" | "passage" | "pin";

const bookmarkKind = (bookmark: Bookmark): BookmarkKind =>
  bookmark.location === null
    ? "page"
    : bookmark.location.kind === "point"
    ? "pin"
    : "passage";

const KIND_ICON = { page: File, passage: TextQuote, pin: MapPin } as const;

const passageText = (bookmark: Bookmark): string | null =>
  bookmark.location && bookmark.location.kind !== "point"
    ? bookmark.location.exact.replace(/\s+/g, " ").trim() || null
    : null;

const defaultTitle = (bookmark: Bookmark): string =>
  bookmarkKind(bookmark) === "pin"
    ? `Pin on page ${bookmark.pageNumber}`
    : passageText(bookmark) ?? `Page ${bookmark.pageNumber}`;

export const bookmarkTitle = (bookmark: Bookmark): string =>
  bookmark.label || defaultTitle(bookmark);

const titleNamesPage = (bookmark: Bookmark): boolean =>
  !bookmark.label && bookmarkKind(bookmark) !== "passage";

const ROW_SELECTOR = "[data-bookmark-row]";
const NAVIGATION_KEYS = ["ArrowDown", "ArrowUp", "Home", "End"];

function moveRowFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (!NAVIGATION_KEYS.includes(event.key)) return;
  if (event.target instanceof HTMLInputElement) return;
  const rows = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(ROW_SELECTOR),
  );
  if (!rows.length) return;
  event.preventDefault();
  const current = rows.findIndex(
    (row) => row.parentElement?.contains(document.activeElement),
  );
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
      ? rows.length - 1
      : event.key === "ArrowDown"
      ? Math.min(rows.length - 1, current + 1)
      : Math.max(0, current - 1);
  rows[next]?.focus();
}

export function BookmarksToolbarIcon({
  active,
  count,
}: {
  active: boolean;
  count: number;
}) {
  return (
    <Button
      variant="ghost"
      size="xs"
      className="h-8 w-8 p-0"
      aria-label={`Bookmarks, ${count} saved${
        active ? ", current page saved" : ""
      }`}
    >
      <BookmarkIcon
        aria-hidden="true"
        className="h-4 w-4"
        fill={active ? "currentColor" : "none"}
      />
    </Button>
  );
}

export function BookmarksToolbarContent({
  bookmarks,
  pageNumber,
  loading,
  savingPage,
  droppingPin,
  onTogglePinDrop,
  onAddPage,
  onOpenBookmark,
  onRenameBookmark,
  onDeleteBookmark,
}: {
  bookmarks: Bookmark[];
  pageNumber: number;
  loading: boolean;
  savingPage: boolean;
  droppingPin: boolean;
  onTogglePinDrop: () => void;
  onAddPage: (pageNumber: number) => Promise<void>;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onRenameBookmark: (bookmark: Bookmark, label: string | null) => Promise<void>;
  onDeleteBookmark: (bookmark: Bookmark) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const pageIsSaved = bookmarks.some(
    (bookmark) =>
      bookmark.pageNumber === pageNumber && bookmark.location === null,
  );

  return (
    <div className="flex items-center gap-1 pr-1">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={loading || savingPage || pageNumber < 1 || pageIsSaved}
        onClick={() => void onAddPage(pageNumber)}
        className="gap-1.5 whitespace-nowrap motion-safe:active:scale-[0.96]"
      >
        {pageIsSaved ? (
          <BookmarkCheck aria-hidden="true" className="h-4 w-4" />
        ) : (
          <BookmarkIcon aria-hidden="true" className="h-4 w-4" />
        )}
        {pageIsSaved ? `Page ${pageNumber} saved` : `Save page ${pageNumber}`}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={loading}
        aria-pressed={droppingPin}
        onClick={onTogglePinDrop}
        className={cn(
          "gap-1.5 whitespace-nowrap motion-safe:active:scale-[0.96]",
          droppingPin &&
            "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
        )}
      >
        <MapPinPlus aria-hidden="true" className="h-4 w-4" />
        {droppingPin ? "Click the page" : "Drop pin"}
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="gap-1.5 whitespace-nowrap tabular-nums motion-safe:active:scale-[0.96]"
            aria-label={`View ${bookmarks.length} bookmarks`}
          >
            <List aria-hidden="true" className="h-4 w-4" />
            {bookmarks.length}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          className="w-80 p-0"
          aria-label="Bookmarks"
        >
          {loading ? (
            <div className="p-1" role="status" aria-label="Loading bookmarks">
              <div className="h-8 animate-pulse rounded-md bg-muted" />
            </div>
          ) : bookmarks.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No bookmarks yet
            </p>
          ) : (
            <div
              role="list"
              className="max-h-80 overflow-y-auto overscroll-contain p-1"
              onKeyDown={moveRowFocus}
            >
              {bookmarks.map((bookmark) => (
                <BookmarkRow
                  key={bookmark.id}
                  bookmark={bookmark}
                  onOpen={() => {
                    setOpen(false);
                    onOpenBookmark(bookmark);
                  }}
                  onRename={(label) => onRenameBookmark(bookmark, label)}
                  onDelete={() => void onDeleteBookmark(bookmark)}
                />
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function BookmarkRow({
  bookmark,
  onOpen,
  onRename,
  onDelete,
}: {
  bookmark: Bookmark;
  onOpen: () => void;
  onRename: (label: string | null) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLButtonElement>(null);
  const Icon = KIND_ICON[bookmarkKind(bookmark)];
  const title = bookmarkTitle(bookmark);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const startEditing = () => {
    setDraft(bookmark.label ?? "");
    setEditing(true);
  };

  const stopEditing = () => {
    setEditing(false);
    requestAnimationFrame(() => rowRef.current?.focus());
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onRename(draft.trim() || null);
      stopEditing();
    } catch {
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form
        role="listitem"
        className="flex h-8 items-center gap-2.5 rounded-md bg-muted px-2 ring-1 ring-inset ring-ring/40"
        onSubmit={(event) => void submit(event)}
      >
        <Icon
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <input
          ref={inputRef}
          aria-label="Bookmark name"
          value={draft}
          maxLength={80}
          disabled={saving}
          placeholder={defaultTitle(bookmark)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (!saving) setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            stopEditing();
          }}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </form>
    );
  }

  return (
    <div
      role="listitem"
      className="group relative flex items-center rounded-md transition-colors duration-100 hover:bg-muted has-[:focus-visible]:bg-muted"
    >
      <button
        ref={rowRef}
        type="button"
        data-bookmark-row
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key !== "F2") return;
          event.preventDefault();
          startEditing();
        }}
        aria-label={`${title}, page ${bookmark.pageNumber}`}
        className="flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 text-left text-sm outline-none"
      >
        <Icon
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span
          className={cn(
            "w-[3.25rem] shrink-0 text-right text-xs tabular-nums text-muted-foreground transition-opacity duration-100 group-hover:opacity-0 group-has-[:focus-visible]:opacity-0",
            titleNamesPage(bookmark) && "invisible",
          )}
        >
          {bookmark.pageNumber}
        </span>
      </button>
      <div className="absolute right-1 flex opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100">
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Rename ${title}`}
          title="Rename"
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:bg-background focus-visible:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${title}`}
          title="Delete"
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground outline-none hover:bg-background hover:text-destructive focus-visible:bg-background focus-visible:text-destructive focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

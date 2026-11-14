import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Bookmark as BookmarkIcon,
  BookmarkCheck,
  Check,
  List,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { Bookmark } from "@uxie/shared/schema";
import { Button } from "@uxie/shared/components/ui/button";
import { Input } from "@uxie/shared/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@uxie/shared/components/ui/popover";
import { ScrollArea } from "@uxie/shared/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@uxie/shared/components/ui/dropdown-menu";

const passageText = (bookmark: Bookmark): string | null => {
  const exact = bookmark.location?.exact.replace(/\s+/g, " ").trim();
  return exact || null;
};

const bookmarkTitle = (bookmark: Bookmark): string =>
  bookmark.label || passageText(bookmark) || `Page ${bookmark.pageNumber}`;

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
  onAddPage,
  onOpenBookmark,
  onRenameBookmark,
  onDeleteBookmark,
}: {
  bookmarks: Bookmark[];
  pageNumber: number;
  loading: boolean;
  savingPage: boolean;
  onAddPage: () => Promise<void>;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onRenameBookmark: (bookmark: Bookmark, label: string | null) => Promise<void>;
  onDeleteBookmark: (bookmark: Bookmark) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const pageIsSaved = bookmarks.some(
    (bookmark) =>
      bookmark.pageNumber === pageNumber && bookmark.location === null,
  );

  useEffect(() => {
    if (!editingId) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [editingId]);

  const beginRename = (bookmark: Bookmark) => {
    setEditingId(bookmark.id);
    setDraftLabel(bookmark.label ?? "");
  };

  const submitRename = async (
    event: FormEvent<HTMLFormElement>,
    bookmark: Bookmark,
  ) => {
    event.preventDefault();
    setSavingLabel(true);
    try {
      await onRenameBookmark(bookmark, draftLabel.trim() || null);
      setEditingId(null);
    } catch {
      renameInputRef.current?.focus();
    } finally {
      setSavingLabel(false);
    }
  };

  return (
    <div className="flex items-center gap-1 pr-1">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        disabled={loading || savingPage || pageNumber < 1 || pageIsSaved}
        onClick={() => void onAddPage()}
        className="gap-1.5 whitespace-nowrap motion-safe:active:scale-[0.96]"
      >
        {pageIsSaved ? (
          <BookmarkCheck aria-hidden="true" className="h-4 w-4" />
        ) : (
          <BookmarkIcon aria-hidden="true" className="h-4 w-4" />
        )}
        {pageIsSaved ? `Page ${pageNumber} saved` : `Save page ${pageNumber}`}
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="gap-1.5 whitespace-nowrap motion-safe:active:scale-[0.96]"
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
          className="w-80 overflow-hidden p-0"
        >
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Bookmarks</h2>
            <p className="text-xs text-muted-foreground">
              Saved in this document
            </p>
          </div>

          {loading ? (
            <div
              className="h-24 p-3"
              aria-label="Loading bookmarks"
              role="status"
            >
              <div className="h-full rounded-md bg-muted" />
            </div>
          ) : bookmarks.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No bookmarks yet.
            </p>
          ) : (
            <ScrollArea className="h-72 overscroll-contain">
              <div className="divide-y">
                {bookmarks.map((bookmark) => {
                  const title = bookmarkTitle(bookmark);
                  const preview = passageText(bookmark);
                  const isEditing = editingId === bookmark.id;

                  return (
                    <div key={bookmark.id} className="group px-2 py-2">
                      {isEditing ? (
                        <form
                          className="flex items-center gap-1"
                          onSubmit={(event) =>
                            void submitRename(event, bookmark)
                          }
                        >
                          <label
                            htmlFor={`bookmark-label-${bookmark.id}`}
                            className="sr-only"
                          >
                            Bookmark label
                          </label>
                          <Input
                            ref={renameInputRef}
                            id={`bookmark-label-${bookmark.id}`}
                            value={draftLabel}
                            maxLength={80}
                            onChange={(event) =>
                              setDraftLabel(event.target.value)
                            }
                            className="h-8 min-w-0"
                            placeholder={`Page ${bookmark.pageNumber}`}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="xs"
                            className="h-8 w-8 p-0"
                            disabled={savingLabel}
                            aria-label="Save bookmark label"
                          >
                            <Check aria-hidden="true" className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="h-8 w-8 p-0"
                            onClick={() => setEditingId(null)}
                            aria-label="Cancel renaming bookmark"
                          >
                            <X aria-hidden="true" className="h-4 w-4" />
                          </Button>
                        </form>
                      ) : (
                        <div className="flex items-start gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              onOpenBookmark(bookmark);
                            }}
                            className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:active:scale-[0.96]"
                            aria-label={`Open ${title}, page ${bookmark.pageNumber}`}
                          >
                            <span className="block truncate text-sm font-medium">
                              {title}
                            </span>
                            <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                              Page {bookmark.pageNumber}
                            </span>
                            {bookmark.label && preview ? (
                              <span className="mt-1 block truncate text-xs text-muted-foreground">
                                {preview}
                              </span>
                            ) : null}
                          </button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                className="h-8 w-8 shrink-0 p-0 opacity-60 focus-visible:opacity-100 group-hover:opacity-100"
                                aria-label={`Actions for ${title}`}
                              >
                                <MoreHorizontal
                                  aria-hidden="true"
                                  className="h-4 w-4"
                                />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => beginRename(bookmark)}
                              >
                                <Pencil
                                  aria-hidden="true"
                                  className="mr-2 h-4 w-4"
                                />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => void onDeleteBookmark(bookmark)}
                              >
                                <Trash2
                                  aria-hidden="true"
                                  className="mr-2 h-4 w-4"
                                />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

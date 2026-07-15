import { useCallback, useEffect, useState } from "react";
import { SearchIcon, SettingsIcon } from "lucide-react";
import { Button } from "@uxie/shared/components/ui/button";
import { Input } from "@uxie/shared/components/ui/input";
import { Skeleton } from "@uxie/shared/components/ui/skeleton";
import { DocCard } from "@uxie/shared/components/workspace/doc-card";
import type { Document } from "@uxie/shared/schema";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Library({
  onOpen,
  onSettings,
}: {
  onOpen: (id: string) => void;
  onSettings: () => void;
}) {
  const [docs, setDocs] = useState<Document[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");

  const refresh = useCallback(() => {
    window.uxieAPI
      .listDocuments()
      .then((d) => {
        setDocs(d);
        setError(null);
      })
      .catch((e) => setError(message(e)));
  }, []);

  useEffect(refresh, [refresh]);

  async function onImport() {
    setImporting(true);
    try {
      const doc = await window.uxieAPI.importDocument();
      if (doc) refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setImporting(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await window.uxieAPI.deleteDocument(id);
      refresh();
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <div className="min-h-full">
      <div className="app-drag h-11 w-full" />
      {docs === null && !error ? (
        <LibrarySkeleton />
      ) : (
        <div className="mx-auto -mt-6 flex w-full max-w-5xl flex-col px-4 py-2 lg:px-16">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 text-2xl font-semibold tracking-tight">
                Your library
              </p>
              <p className="text-muted-foreground">
                {(docs?.length ?? 0) === 0
                  ? "No files yet — import a PDF to get started."
                  : "Here are your files"}
              </p>
            </div>
            <div className="app-no-drag flex items-center gap-2">
              <button
                onClick={onSettings}
                aria-label="Settings"
                className="rounded-md p-1.5 text-muted-foreground transition-all duration-150 hover:bg-gray-100 hover:text-foreground active:scale-90"
              >
                <SettingsIcon
                  size={18}
                  className="transition-transform duration-300 hover:rotate-45"
                />
              </button>
              <Button onClick={onImport} disabled={importing}>
                {importing ? "Importing…" : "Import PDF"}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              <span>{error}</span>
              <button onClick={refresh} className="font-medium underline">
                Retry
              </button>
            </div>
          )}

          {docs && docs.length > 0 && (
            <div className="flex flex-col justify-center">
              <div className="relative my-4">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="border-gray-200 pl-9"
                  type="search"
                  placeholder="Search for a document"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {(() => {
                const filtered = docs.filter((d) =>
                  d.title
                    .trim()
                    .toLowerCase()
                    .includes(search.trim().toLowerCase()),
                );
                return filtered.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4 xl:gap-3">
                    {filtered.map((doc) => (
                      <DocCard
                        key={doc.id}
                        title={doc.title}
                        isCollab={false}
                        isVectorised={doc.isVectorised}
                        coverImageUrl={doc.coverImageUrl}
                        pageCount={doc.pageCount}
                        lastReadPage={doc.lastReadPage}
                        onOpen={() => onOpen(doc.id)}
                        onDelete={() => onDelete(doc.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No documents found, try changing your search query.
                  </p>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="mx-auto -mt-6 flex w-full max-w-5xl flex-col px-4 py-2 lg:px-16">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="mb-1 h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="my-4 h-10 w-full" />
      <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-md border border-gray-200"
          >
            <Skeleton className="aspect-[3/4] w-full" />
            <div className="flex flex-col gap-1 p-2.5">
              <Skeleton className="h-5 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

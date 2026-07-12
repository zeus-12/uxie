import { useCallback, useEffect, useState } from "react";
import type { Document } from "@uxie/shared/schema";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Library({
  onOpen,
  onSettings,
  onAssistant,
}: {
  onOpen: (id: string) => void;
  onSettings: () => void;
  onAssistant: () => void;
}) {
  const [docs, setDocs] = useState<Document[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

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
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex items-center justify-between px-8 py-6">
        <h1 className="text-xl font-semibold tracking-tight">Uxie</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onAssistant}
            className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Assistant
          </button>
          <button
            onClick={onSettings}
            className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Settings
          </button>
          <button
            onClick={onImport}
            disabled={importing}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {importing ? "Importing…" : "Import PDF"}
          </button>
        </div>
      </header>

      <main className="px-8 pb-12">
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <span>{error}</span>
            <button onClick={refresh} className="font-medium underline">
              Retry
            </button>
          </div>
        )}
        {docs === null && error ? null : docs === null ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No documents yet. Import a PDF to get started.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="group relative flex cursor-pointer flex-col rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
                onClick={() => onOpen(doc.id)}
              >
                <span className="truncate font-medium">{doc.title}</span>
                <span className="mt-1 text-xs text-zinc-500">
                  {doc.pageCount} pages
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDelete(doc.id);
                  }}
                  className="absolute right-2 top-2 hidden rounded px-2 py-1 text-xs text-zinc-400 hover:text-red-500 group-hover:block"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

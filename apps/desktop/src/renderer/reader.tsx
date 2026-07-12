import { useEffect, useState } from "react";
import type { DocumentWithHighlights } from "@uxie/shared/schema";

export function Reader({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const [doc, setDoc] = useState<DocumentWithHighlights | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.uxieAPI
      .getDocument(id)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Library
        </button>
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {doc?.title ?? ""}
        </span>
      </header>

      {error ? (
        <p className="p-6 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : doc === undefined ? (
        <p className="p-6 text-sm text-zinc-500">Loading…</p>
      ) : doc === null ? (
        <p className="p-6 text-sm text-zinc-500">Document not found.</p>
      ) : (
        <iframe
          title={doc.title}
          src={doc.url}
          className="w-full flex-1 border-0"
        />
      )}
    </div>
  );
}

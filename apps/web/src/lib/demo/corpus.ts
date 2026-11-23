import { useEffect, useState } from "react";

export type CorpusEntry = { name: string; pageCount: number };

export const corpusUrl = (name: string) => `/reflow-corpus/${encodeURIComponent(name)}.pdf`;

export const useReflowCorpus = (): CorpusEntry[] | null => {
  const [entries, setEntries] = useState<CorpusEntry[] | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    let cancelled = false;
    fetch("/reflow-corpus/index.json")
      .then((res) => (res.ok ? (res.json() as Promise<CorpusEntry[]>) : null))
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return entries;
};

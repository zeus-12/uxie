import type { PDFDocumentProxy } from "pdfjs-dist";
import { extractPageInput, extractTextOnly } from "./extract";
import { buildProfile, samplePageNumbers } from "./profile";
import { reconstructPage } from "./reconstruct";
import type { DocumentProfile, PageInput, ReflowPage } from "./types";

export type ReflowSource = {
  pageInput: (pageNumber: number) => Promise<PageInput>;
  page: (pageNumber: number) => Promise<ReflowPage>;
  profile: () => Promise<DocumentProfile>;
};

const memo = <K, V>(fn: (key: K) => Promise<V>) => {
  const cache = new Map<K, Promise<V>>();
  return (key: K) => {
    let hit = cache.get(key);
    if (!hit) {
      hit = fn(key);
      cache.set(key, hit);
      hit.catch(() => cache.delete(key));
    }
    return hit;
  };
};

export const createReflowSource = (doc: PDFDocumentProxy): ReflowSource => {
  let profilePromise: Promise<DocumentProfile> | null = null;
  const profile = () => {
    profilePromise ??= Promise.all(
      samplePageNumbers(doc.numPages).map(async (n) => extractTextOnly(await doc.getPage(n))),
    ).then(buildProfile);
    return profilePromise;
  };
  const pageInput = memo(async (n: number) => extractPageInput(await doc.getPage(n)));
  const page = memo(async (n: number) => {
    const [p, input] = await Promise.all([profile(), pageInput(n)]);
    return reconstructPage(input, p);
  });
  return { pageInput, page, profile };
};

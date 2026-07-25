type MaybePaged = { pageNumber?: number | null };

/**
 * The page a highlight sits on. It is stored on the highlight itself, but
 * highlights created before that column existed only carry it on their rects,
 * so fall back through those.
 */
export const getHighlightPageNumber = (position: {
  pageNumber?: number | null;
  boundingRect?: MaybePaged | null;
  rects?: MaybePaged[] | null;
}): number | null =>
  [
    position.pageNumber,
    position.boundingRect?.pageNumber,
    ...(position.rects ?? []).map((rect) => rect.pageNumber),
  ].find((page): page is number => typeof page === "number" && page > 0) ??
  null;

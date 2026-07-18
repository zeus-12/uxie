import { type AppRouter } from "@/server/api/root";
import { type inferRouterOutputs } from "@trpc/server";

type Rect = {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  pageNumber?: number | null;
  id?: string;
};

/**
 * The structural subset of a document that the reader subtree (PdfReader →
 * PdfHighlighter) actually renders. It lets the demo reuse the production reader
 * components instead of copying them.
 *
 * Scalars are derived from the tRPC `getDocData` output so the real reader
 * satisfies it exactly. `highlights` is typed loosely enough that both the
 * DB-shaped highlights and the demo's local highlights satisfy it — the
 * highlighter treats a highlight's geometry opaquely (it hands it straight to
 * react-pdf-highlighter), so no precision is lost here.
 */
export type ReaderDoc = Pick<
  inferRouterOutputs<AppRouter>["document"]["getDocData"],
  "id" | "title" | "url" | "isVectorised" | "pageCount" | "lastReadPage"
> & {
  highlights: Array<{
    id: string;
    position: { boundingRect: Rect; rects: Rect[]; pageNumber: number | null };
  }>;
};

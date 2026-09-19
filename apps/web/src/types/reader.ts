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

export type DocumentData =
  inferRouterOutputs<AppRouter>["document"]["getDocData"];
export type PdfDocumentData = Extract<DocumentData, { kind: "pdf" }>;
export type ArticleDocumentData = Extract<DocumentData, { kind: "article" }>;

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
  PdfDocumentData,
  | "id"
  | "title"
  | "url"
  | "isVectorised"
  | "pageCount"
  | "lastReadPage"
  | "zoomLevel"
> & {
  highlights: Array<{
    id: string;
    position: { boundingRect: Rect; rects: Rect[]; pageNumber: number | null };
  }>;
};

export enum HighlightContentType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
}

export interface HighlightContentTypes {
  content:
    | {
        text: string;
      }
    | {
        image: string;
      };
}
export interface HighlightType extends HighlightContentTypes {
  position: HighlightPositionType;
  id: string;
}

export interface HighlightPositionType {
  boundingRect: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
    pageNumber?: number;
  };
  rects: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
    pageNumber?: number;
  }[];
  pageNumber: number;
}

export interface HighlightPositionTypeWithDocumentId
  extends HighlightPositionType,
    HighlightContentTypes {
  documentId: string;
}

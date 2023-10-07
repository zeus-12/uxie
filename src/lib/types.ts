import { Highlight } from "react-pdf-highlighter";

export enum HighlightContentType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
}

export interface HighlightType {
  content:
    | {
        text: string;
      }
    | {
        image: string;
      };
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

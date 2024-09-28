import { type PDFViewer } from "pdfjs-dist/types/web/pdf_viewer";

declare global {
  interface Window {
    PdfViewer: PdfViewerType;
  }
}

window.PdfViewer = window.PdfViewer || {};

interface PdfViewerType {
  viewer: PDFViewer;
}

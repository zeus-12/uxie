import { FC, cloneElement, useEffect, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  // type PDFDocumentProxy,
} from "pdfjs-dist/legacy/build/pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface Props {
  workerSrc?: string;
  url: string;
  beforeLoad: JSX.Element;
  errorMessage?: JSX.Element;
  children: (pdfDocument: PDFDocumentProxy) => JSX.Element;
  onError?: (error: Error) => void;
  cMapUrl?: string;
  cMapPacked?: boolean;
}

export const PdfLoader: FC<Props> = (props) => {
  const {
    workerSrc,
    url,
    beforeLoad,
    errorMessage,
    children,
    onError,
    cMapUrl,
    cMapPacked,
  } = props;

  console.log(workerSrc, "wokrer");

  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const documentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const { ownerDocument = document } = documentRef.current || {};
      const discardedDocument = pdfDocument;
      setPdfDocument(null);
      setError(null);

      if (typeof workerSrc === "string") {
        GlobalWorkerOptions.workerSrc = workerSrc;
      }

      try {
        discardedDocument && discardedDocument.destroy();

        if (!url) {
          return;
        }

        const pdf = await getDocument({
          ...props,
          ownerDocument,
          cMapUrl,
          cMapPacked,
        }).promise;

        setPdfDocument(pdf);
      } catch (e: any) {
        onError && onError(e);
        setError(e);
      }
    };

    load();
  }, [
    url,
    // url, workerSrc, props, pdfDocument, onError, cMapUrl, cMapPacked
  ]);

  useEffect(() => {
    return () => {
      const discardedDocument = pdfDocument;
      discardedDocument && discardedDocument.destroy();
    };
  }, [pdfDocument]);

  const renderError = () => {
    if (errorMessage) {
      return cloneElement(errorMessage, { error });
    }
    return null;
  };

  return (
    <>
      <span ref={documentRef} />
      {error
        ? renderError()
        : !pdfDocument || !children
        ? beforeLoad
        : children(pdfDocument)}
    </>
  );
};

PdfLoader.defaultProps = {
  workerSrc: "https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js",
};

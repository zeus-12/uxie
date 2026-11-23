import type { ComponentProps, ComponentType } from "react";
import { PdfLoader as LibraryPdfLoader } from "react-pdf-highlighter";
import { useReflowOnZoom } from "../../hooks/use-reflow-on-zoom";

type Props = Omit<ComponentProps<typeof LibraryPdfLoader>, "workerSrc"> & {
  workerSrc?: string;
};

// The library spreads its props into pdf.js getDocument but doesn't type them;
// reflow needs the FixedPitch flag, which pdf.js only exports with this option.
const Loader = LibraryPdfLoader as unknown as ComponentType<
  Props & { fontExtraProperties: boolean }
>;

export const PdfLoader = (props: Props) => {
  const { available } = useReflowOnZoom();
  return <Loader {...props} fontExtraProperties={available} />;
};

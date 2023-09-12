import dynamic from "next/dynamic";

const DynamicDocViewer = dynamic(
  (() => {
    if (typeof window !== "undefined") {
      return import("./DocViewer");
    }
  }) as any,
  { ssr: false },
);

export default DynamicDocViewer;

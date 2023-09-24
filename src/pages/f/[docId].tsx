import dynamic from "next/dynamic";

const DynamicDocViewerPage = dynamic(
  (() => {
    if (typeof window !== "undefined") {
      return import("@/components/ReaderScreen");
    }
  }) as any,
  { ssr: false },
);

export default DynamicDocViewerPage;

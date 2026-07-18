import dynamic from "next/dynamic";

// The reader relies on browser-only APIs (react-pdf-highlighter / pdf.js), so
// it must never be server-rendered.
const DemoWorkspace = dynamic(
  () => import("@/components/demo/demo-workspace"),
  { ssr: false },
);

export default function DemoPage() {
  return <DemoWorkspace />;
}

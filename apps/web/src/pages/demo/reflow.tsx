import dynamic from "next/dynamic";

const ReflowPrototype = dynamic(
  () => import("@/components/demo/reflow-prototype"),
  { ssr: false },
);

export default function ReflowPrototypePage() {
  return <ReflowPrototype />;
}

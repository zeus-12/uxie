import { corpusUrl, useReflowCorpus } from "@/lib/demo/corpus";
import { closeCorpusDoc, openCorpusDoc, useDemoDocStore } from "@/lib/demo/store";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect } from "react";

// The reader relies on browser-only APIs (react-pdf-highlighter / pdf.js), so
// it must never be server-rendered.
const DemoWorkspace = dynamic(
  () => import("@/components/demo/demo-workspace"),
  { ssr: false },
);

export default function DemoPage() {
  const docId = useDemoDocStore((s) => s.id);
  const corpus = useReflowCorpus();
  const router = useRouter();
  const requested = router.query.doc;

  useEffect(() => {
    if (router.isReady && !requested && docId.startsWith("corpus:")) closeCorpusDoc();
  }, [router.isReady, requested, docId]);

  useEffect(() => {
    const entry = corpus?.find((e) => e.name === requested);
    if (!entry || docId === `corpus:${entry.name}`) return;
    openCorpusDoc({
      id: `corpus:${entry.name}`,
      title: entry.name,
      url: corpusUrl(entry.name),
      note: null,
      isVectorised: false,
      pageCount: entry.pageCount,
      lastReadPage: 1,
      zoomLevel: null,
      highlights: [],
    });
  }, [corpus, requested, docId]);

  return <DemoWorkspace key={docId} />;
}

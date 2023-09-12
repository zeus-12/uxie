import { useRouter } from "next/router";

const DocViewerPage = () => {
  const router = useRouter();
  const {
    query: { docId },
    isReady,
  } = router;

  if (!isReady) return <p>loading</p>;

  return <div>{docId}</div>;
};
export default DocViewerPage;

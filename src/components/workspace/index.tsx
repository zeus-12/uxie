import DocViewer from "@/components/pdf-reader";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SpinnerPage } from "@/components/ui/spinner";
import Sidebar from "@/components/workspace/sidebar";
import { api } from "@/lib/api";
import { useRouter } from "next/router";
import { toast } from "sonner";

const DocViewerPage = () => {
  const { query, push } = useRouter();

  const docId = query.docId as string;

  const {
    data: doc,
    isLoading,
    isError,
    error,
  } = api.document.getDocData.useQuery(
    {
      docId,
    },
    {
      enabled: !!query?.docId,
    },
  );

  if (isLoading) {
    return <SpinnerPage />;
  }

  if (isError) {
    if (error?.data?.code === "UNAUTHORIZED") {
      push("/f");

      toast.error(error.message, {
        duration: 3000,
      });
    }
    return <>Something went wrong :( </>;
  }

  return (
    <ResizablePanelGroup autoSaveId="window-layout" direction="horizontal">
      <ResizablePanel defaultSize={50} minSize={30}>
        <div className="hd-screen min-w-[25vw] border-stone-200 bg-white sm:rounded-lg sm:border-r sm:shadow-lg">
          <DocViewer doc={doc} canEdit={doc.userPermissions.canEdit} />
        </div>
      </ResizablePanel>

      <div className="group w-2 items-center justify-center rounded-md bg-gray-50 hidden md:flex">
        <ResizableHandle className="h-12 w-1 rounded-full bg-neutral-400 duration-300 group-hover:bg-primary group-active:bg-primary group-active:duration-75 lg:h-24" />
      </div>

      <ResizablePanel
        defaultSize={50}
        minSize={30}
        className="hidden md:inline-flex"
      >
        <div className="h-full min-w-[25vw] flex-1">
          <Sidebar
            canEdit={doc.userPermissions.canEdit}
            isOwner={doc.userPermissions.isOwner}
            isVectorised={doc.isVectorised}
            note={doc.note}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
export default DocViewerPage;

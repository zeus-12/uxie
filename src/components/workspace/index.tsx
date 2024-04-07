import DocViewer from "@/components/pdf-reader";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { SpinnerPage } from "@/components/ui/spinner";
import { toast } from "@/components/ui/use-toast";
import Sidebar from "@/components/workspace/sidebar";
import { api } from "@/lib/api";
import { useRouter } from "next/router";

const DocViewerPage = () => {
  const { query, push } = useRouter();

  const {
    data: doc,
    isLoading,
    isError,
    error,
  } = api.document.getDocData.useQuery(
    {
      docId: query.docId as string,
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

      toast({
        title: "Unauthorized",
        description: error.message,
        variant: "destructive",
        duration: 4000,
      });
    }
    return <>Something went wrong :( </>;
  }

  return (
    <>
      <ResizablePanelGroup autoSaveId="window-layout" direction="horizontal">
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-screen min-w-[25vw] border-stone-200 bg-white sm:rounded-lg sm:border-r sm:shadow-lg">
            <DocViewer doc={doc} canEdit={doc.userPermissions.canEdit} />
          </div>
        </ResizablePanel>
        <div className="group flex w-2 cursor-col-resize items-center justify-center rounded-md bg-gray-50">
          <ResizableHandle className="h-1 w-24 rounded-full bg-neutral-400 duration-300 group-hover:bg-primary group-active:bg-primary group-active:duration-75 lg:h-24 lg:w-1" />
        </div>
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full min-w-[25vw] flex-1">
            <Sidebar
              canEdit={doc.userPermissions.canEdit}
              username={doc.userPermissions.username}
              isOwner={doc.userPermissions.isOwner}
              isVectorised={doc.isVectorised}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  );
};
export default DocViewerPage;

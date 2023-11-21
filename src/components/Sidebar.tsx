import Chat from "@/components/Chat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlbumIcon, Download, MessagesSquareIcon } from "lucide-react";
import Editor from "@/components/Editor";
import { saveAs } from "file-saver";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useBlocknoteEditorStore } from "@/lib/store";
import { RoomProvider } from "liveblocks.config";
import { ClientSideSuspense } from "@liveblocks/react";
import { Spinner } from "@/components/Spinner";
import { useRouter } from "next/router";
import InviteCollab from "./InviteCollab";
import { useState } from "react";

const Sidebar = ({
  canEdit,
  username,
  isOwner,
  isVectorised,
}: {
  canEdit: boolean;
  username: string;
  isOwner: boolean;
  isVectorised: boolean;
}) => {
  const { query } = useRouter();
  const documentId = query?.docId as string;

  const { editor } = useBlocknoteEditorStore();

  const handleDownloadMarkdownAsFile = async () => {
    if (!editor) return;
    const markdownContent = await editor.blocksToMarkdown(
      editor.topLevelBlocks,
    );

    const blob = new Blob([markdownContent], { type: "text/markdown" });
    saveAs(blob, "notes.md");
  };

  const [activeIndex, setActiveIndex] = useState("notes");

  return (
    <div className="bg-gray-50">
      <Tabs
        value={activeIndex}
        onValueChange={(value) => setActiveIndex(value)}
        defaultValue="notes"
        className="max-h-screen max-w-full overflow-hidden"
      >
        <div className="flex items-center justify-between pr-1">
          <TabsList className="h-12 rounded-md bg-gray-200">
            {[
              {
                value: "notes",
                icon: <AlbumIcon size={20} />,
              },
              {
                value: "chat",
                icon: <MessagesSquareIcon size={20} />,
              },
              // {
              //   value: "highlights",
              //   icon: <MessagesSquareIcon size={20} />,
              // }
            ].map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.icon}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center">
            {isOwner && <InviteCollab />}

            <div
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "ml-auto cursor-pointer border-stone-200 bg-white px-2 text-xs shadow-sm sm:border",
              )}
              onClick={handleDownloadMarkdownAsFile}
            >
              <Download size={20} />
            </div>
          </div>
        </div>

        {[
          {
            value: "notes",
            tw: "flex-1 overflow-scroll border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg h-[calc(100vh-4rem)] w-full overflow-scroll",
            children: (
              <RoomProvider
                id={`doc-${documentId}`}
                initialPresence={
                  {
                    // TODO: figure out what this is
                    // name: "User",
                    // color: "red",
                  }
                }
              >
                <ClientSideSuspense
                  fallback={
                    <div className="flex min-h-screen items-center justify-center">
                      <Spinner />
                    </div>
                  }
                >
                  {() => (
                    <Editor
                      canEdit={canEdit ?? false}
                      username={username ?? "User"}
                    />
                  )}
                </ClientSideSuspense>
              </RoomProvider>
            ),
          },
          {
            value: "chat",
            tw: " p-2 break-words border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg h-[calc(100vh-4rem)] w-full overflow-scroll ",
            children: <Chat isVectorised={isVectorised} />,
          },
        ].map((item) => (
          <TabsContent
            key={item.value}
            forceMount
            hidden={item.value !== activeIndex}
            value={item.value}
            className={item.tw}
          >
            {item.children}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
export default Sidebar;

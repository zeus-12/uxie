import Chat from "@/components/Chat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlbumIcon,
  Download,
  MessagesSquareIcon,
  UserPlus,
} from "lucide-react";
import Editor from "@/components/Editor";
import { saveAs } from "file-saver";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { useBlocknoteEditorStore } from "@/lib/store";
import { RoomProvider } from "liveblocks.config";
import { ClientSideSuspense } from "@liveblocks/react";
import { Spinner } from "@/components/Spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useState } from "react";
import { z } from "zod";
import { CollaboratorRole } from "@prisma/client";
import { useRouter } from "next/router";

const Sidebar = () => {
  const { editor } = useBlocknoteEditorStore();

  const handleDownloadMarkdownAsFile = async () => {
    if (!editor) return;
    const markdownContent = await editor.blocksToMarkdown(
      editor.topLevelBlocks,
    );

    const blob = new Blob([markdownContent], { type: "text/markdown" });
    saveAs(blob, "notes.md");
  };

  return (
    <div className="bg-gray-50">
      <Tabs
        defaultValue="notes"
        className="max-h-screen max-w-full overflow-hidden"
      >
        <div className="flex items-center justify-between pr-1">
          <TabsList className="h-12 rounded-md bg-gray-200">
            <TabsTrigger value="notes">
              <AlbumIcon size={20} />
            </TabsTrigger>

            <TabsTrigger value="chat">
              <MessagesSquareIcon size={20} />
            </TabsTrigger>
            {/* <TabsTrigger value="highlights">
            <Highlighter size={24} />
          </TabsTrigger> */}
          </TabsList>
          <div>
            <InviteCollab />
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

        <TabsContent
          value="notes"
          className="flex-1 overflow-scroll border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg"
        >
          <RoomProvider id="my-room" initialPresence={{}}>
            <ClientSideSuspense
              fallback={
                <div className="flex min-h-screen items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              {() => <Editor />}
            </ClientSideSuspense>
          </RoomProvider>
        </TabsContent>

        <TabsContent value="chat">
          <div className="relative h-[calc(100vh-4rem)] w-full max-w-screen-lg overflow-scroll break-words border-stone-200 bg-white p-2 sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:shadow-lg ">
            <Chat />
          </div>
        </TabsContent>

        {/* <TabsContent value="highlights">
          <div className="relative h-[calc(100vh-4rem)] w-full max-w-screen-lg overflow-scroll break-words border-stone-200 bg-white p-2 sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:p-4 sm:shadow-lg lg:p-8 ">
            <PdfHighlights highlights={highlights}
            
              // docId={docId}
            />
          </div>
        </TabsContent> */}
      </Tabs>
    </div>
  );
};
export default Sidebar;

type CollaboratorRoleValuesUnion = keyof typeof CollaboratorRole;
interface CollaboratorType {
  userId: string;
  role: CollaboratorRoleValuesUnion;
}

const InviteCollab = () => {
  return <></>;
  // some really dumb code
  // const { query } = useRouter();
  // const documentId = query?.docId;

  // const { mutate } = api.document.updateCollaborators.useMutation();
  // const [collaborators, setCollaborators] = useState<CollaboratorType[]>([]);

  // const addCollaborator = async () => {
  //   if (!email) return;

  //   await mutate({
  //     documentId: docId,
  //     collaborators,
  //   });
  // };
  // return (
  //   <Dialog>
  //     <DialogTrigger>
  //       <UserPlus size={24} />
  //     </DialogTrigger>
  //     <DialogContent>
  //       <DialogHeader>
  //         <DialogTitle>Invite to collaborate?</DialogTitle>
  //         <DialogDescription>
  //           <div className="my-4 flex gap-2">
  //             <input
  //               className="flex-1 border-b-[1px] px-1"
  //               placeholder="Email"
  //               type="email"
  //               inputMode="email"
  //               value={email}
  //               onChange={(e) => setEmail((e.target as CollaboratorRoleValuesUnion).value)}
  //             />
  //             <select
  //               className="w-[180px] border-b-[1px] py-2"
  //               value={role}
  //               // @ts-ignore
  //               onChange={(e) => setRole((e.target as "READ" | "WRITE").value)}
  //             >
  //               <option value="READ">Read</option>
  //               <option value="WRITE">Write</option>
  //             </select>
  //           </div>

  //           <div className="flex justify-end">
  //             <Button onClick={addCollaborator}>Submit</Button>
  //           </div>
  //         </DialogDescription>
  //       </DialogHeader>
  //     </DialogContent>
  //   </Dialog>
  // );
};

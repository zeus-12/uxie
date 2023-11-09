import Chat from "@/components/Chat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlbumIcon,
  DeleteIcon,
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
import { CollaboratorRole } from "@prisma/client";
import { useRouter } from "next/router";
import { toast } from "@/components/ui/use-toast";

const Sidebar = () => {
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
          <RoomProvider id={`doc-${documentId}`} initialPresence={{}}>
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

const InviteCollab = () => {
  const { query } = useRouter();
  const documentId = query?.docId as string;

  const { data } = api.document.getCollaborators.useQuery({
    documentId,
  });
  const { mutate } = api.document.addCollaborator.useMutation();
  const { mutate: removeCollaboratorByIdMutation } =
    api.document.removeCollaboratorById.useMutation();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRoleValuesUnion>(
    CollaboratorRole.VIEWER,
  );

  const addCollaborator = async () => {
    try {
      if (!email || !role) return;
      mutate({
        documentId,
        data: {
          email,
          role,
        },
      });
      // todo do optimisitc update here
      setEmail("");
      setRole(CollaboratorRole.VIEWER);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const removeCollaboratorById = async (id: string) => {
    removeCollaboratorByIdMutation({
      documentId,
      userId: id,
    });
  };

  return (
    <Dialog>
      <DialogTrigger>
        <UserPlus size={24} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to collaborate?</DialogTitle>
          <DialogDescription>
            <div className="my-4 flex gap-2">
              <input
                className="flex-1 border-b-[1px] px-1"
                placeholder="Email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <select
                className="w-[180px] border-b-[1px] py-2"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as CollaboratorRoleValuesUnion)
                }
              >
                {["VIEWER", "EDITOR"].map((role) => (
                  <option key={role} value={role}>
                    {role[0] + role.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>

              <button
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
                onClick={addCollaborator}
              >
                Invite
              </button>
            </div>

            <div>
              {data?.map((user, id) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{user.email}</span>
                  <div>
                    <span>{user.role}</span>
                    <DeleteIcon
                      size={20}
                      onClick={() => removeCollaboratorById(user.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

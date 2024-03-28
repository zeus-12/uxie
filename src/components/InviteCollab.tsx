import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import { CollaboratorRole } from "@prisma/client";
import { TrashIcon, UserPlus, XIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";

type CollaboratorRoleValuesUnion = keyof typeof CollaboratorRole;

const InviteCollab = () => {
  const { query } = useRouter();
  const documentId = query?.docId as string;

  const { data: collaborators } = api.document.getCollaborators.useQuery({
    documentId,
  });

  const utils = api.useContext();

  const { mutate: addCollaboratorMutation } =
    api.document.addCollaborator.useMutation({
      async onMutate({ documentId, data: { email, role } }) {
        await utils.document.getCollaborators.cancel();

        const prevData = utils.document.getCollaborators.getData({
          documentId,
        });

        utils.document.getCollaborators.setData(
          { documentId: documentId as string },
          (old) => [
            ...(old ?? []),
            {
              email,
              role,
              id: createId(),
            },
          ],
        );

        return { prevData };
      },
      onError(err, newPost, ctx) {
        toast({
          title: "Error",
          description: "Make sure user exists, and is not already added.",
          variant: "destructive",
          duration: 4000,
        });

        utils.document.getCollaborators.setData(
          { documentId: documentId as string },
          ctx?.prevData,
        );
      },
      onSettled() {
        // Sync with server once mutation has settled
        utils.document.getCollaborators.invalidate();
      },
    });

  const { mutate: removeCollaboratorByIdMutation } =
    api.document.removeCollaboratorById.useMutation({
      async onMutate({ documentId, userId }) {
        await utils.document.getCollaborators.cancel();
        const prevData = utils.document.getCollaborators.getData({
          documentId,
        });

        utils.document.getCollaborators.setData(
          { documentId: documentId as string },
          (old) => [...(old ?? []).filter((user) => user.id !== userId)],
        );

        return { prevData };
      },
      onError(err, newPost, ctx) {
        toast({
          title: "Error",
          description: "Make sure user exists, and is not already added.",
          variant: "destructive",
          duration: 4000,
        });

        utils.document.getCollaborators.setData(
          { documentId: documentId as string },
          ctx?.prevData,
        );
      },
      onSettled() {
        // Sync with server once mutation has settled
        utils.document.getCollaborators.invalidate();
      },
    });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRoleValuesUnion>(
    CollaboratorRole.VIEWER,
  );

  const addCollaborator = async () => {
    try {
      if (!email || !role) return;
      addCollaboratorMutation({
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
        <div
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "ml-auto cursor-pointer border-stone-200 bg-white px-2 text-xs shadow-sm sm:border",
          )}
        >
          <UserPlus size={20} />
        </div>
      </DialogTrigger>
      <DialogContent hideClose={true}>
        <DialogHeader>
          <div className="mb-2 flex items-center justify-between ">
            <DialogTitle className="text-2xl">Team</DialogTitle>
            <DialogClose>
              <XIcon
                size={20}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none "
              />
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="space-y-2">
          <div className="space-y-2 rounded-md border-[0.5px] border-gray-200 bg-[#fdfeff] p-3">
            <p className="mb-2 font-semibold">Invite members</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Input
                className="flex-1 px-2"
                value={email}
                placeholder="Email"
                type="email"
                inputMode="email"
                onChange={(e) => setEmail(e.target.value)}
              />

              <Select
                value={role}
                onValueChange={(value) =>
                  setRole(value as CollaboratorRoleValuesUnion)
                }
              >
                <SelectTrigger className="w-[180px] px-2">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent className="mt-1 w-[180px] border-b-[1px]">
                  {["VIEWER", "EDITOR"].map((role) => (
                    <SelectItem key={role} value={role}>
                      {role[0] + role.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className={cn(buttonVariants({ size: "sm" }))}
              onClick={addCollaborator}
            >
              Invite
            </Button>
          </div>

          <div className="space-y-2 rounded-md border-[0.5px] border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 font-medium">Team members</p>
            <div className="mb-6 mt-4 space-y-2 text-sm text-muted-foreground">
              {collaborators?.map((user, id) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>{user.email}</span>
                  <div className="flex gap-2">
                    <Badge>{user.role}</Badge>
                    <TrashIcon
                      className={cn(
                        // && isOwner
                        user.role === CollaboratorRole.OWNER && "invisible",
                        "hover:cursor-pointer hover:fill-red-400 hover:text-red-400",
                      )}
                      size={20}
                      onClick={() => removeCollaboratorById(user.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteCollab;

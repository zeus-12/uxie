import { CollaboratorRole } from "@prisma/client";
import { useRouter } from "next/router";
import { TrashIcon, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
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
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { createId } from "@paralleldrive/cuid2";

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
        await utils.document.getDocData.cancel();
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
        utils.document.getDocData.invalidate();
      },
    });

  const { mutate: removeCollaboratorByIdMutation } =
    api.document.removeCollaboratorById.useMutation({
      async onMutate({ documentId, userId }) {
        await utils.document.getDocData.cancel();
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
        utils.document.getDocData.invalidate();
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

            <div className="mt-8 space-y-2">
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
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default InviteCollab;

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

type CollaboratorRoleValuesUnion = keyof typeof CollaboratorRole;

const InviteCollab = () => {
  const { query } = useRouter();
  const documentId = query?.docId as string;

  const { data: collaborators } = api.document.getCollaborators.useQuery({
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
                    <span>{user.role}</span>
                    {user.role !== CollaboratorRole.OWNER && (
                      // isOwner &&
                      <TrashIcon
                        size={20}
                        onClick={() => removeCollaboratorById(user.id)}
                      />
                    )}
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

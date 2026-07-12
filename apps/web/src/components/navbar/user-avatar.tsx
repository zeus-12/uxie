import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { type User } from "@prisma/client";
import { type AvatarProps } from "@radix-ui/react-avatar";
import { User as UserIcon } from "lucide-react";
import Image from "next/image";

interface UserAvatarProps extends AvatarProps {
  user: Pick<User, "image" | "name">;
}

export function UserAvatar({ user, ...props }: UserAvatarProps) {
  return (
    <Avatar {...props}>
      {user.image ? (
        <Image
          src={user.image}
          alt="Picture"
          fill
          className="aspect-square size-full"
        />
      ) : (
        <AvatarFallback>
          <span className="sr-only">{user.name}</span>
          <UserIcon className="h-4 w-4" />
        </AvatarFallback>
      )}
    </Avatar>
  );
}

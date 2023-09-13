import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { UserAccountNav } from "@/components/user-account-nav";
import { ModeToggle } from "@/components/theme-toggle";

const Navbar = () => {
  const { data: session } = useSession();

  return (
    <div className="my-2 flex items-center justify-between bg-opacity-30 backdrop-blur-lg backdrop-filter">
      <Link href="/">
        <div className="flex items-center gap-2">
          <Image alt="Uxie" src="/uxie-logo.png" width={50} height={100} />
          <span className="font-semibold">Uxie</span>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <ModeToggle />
        {session ? (
          <UserAccountNav user={session.user} />
        ) : (
          <Button>Sign in</Button>
        )}
      </div>
    </div>
  );
};
export default Navbar;

import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { UserAccountNav } from "@/components/user-account-nav";

const Navbar = () => {
  const { data: session } = useSession();

  return (
    <div className="flex items-center justify-between bg-opacity-30 backdrop-blur-lg backdrop-filter">
      <Link href="/">
        <div className="flex items-center gap-2">
          <Image alt="Uxie" src="/logo.png" width={50} height={100} />
          <span className="font-semibold">Uxie</span>
        </div>
      </Link>
      {session ? (
        <UserAccountNav user={session.user} />
      ) : (
        <Button>
          <Link href="/login">Sign in</Link>
        </Button>
      )}
    </div>
  );
};
export default Navbar;

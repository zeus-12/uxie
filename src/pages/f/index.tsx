import { Icons } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

const UserLibraryPage = () => {
  const {
    data: userDocs,
    isError,
    isLoading,
  } = api.document.getUsersDocs.useQuery();

  if (isError) return <div>error</div>;
  if (isLoading) return <div>loading...</div>;
  if (!userDocs) return <div>sorry no result found</div>;

  return (
    <div className="container flex w-screen flex-col">
      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "w-fit justify-start",
        )}
      >
        <Icons.chevronLeft className="mr-2 h-4 w-4" />
        Back
      </Link>
      <p className="text-2xl font-semibold tracking-tighter">
        Hello, {userDocs?.name || "User"}
      </p>
      <p className="text-muted-foreground">Here are your files</p>
    </div>
  );
};
export default UserLibraryPage;

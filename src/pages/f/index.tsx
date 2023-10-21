import { Spinner } from "@/components/Spinner";
import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { UploadButton } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";
import Link from "next/link";

const UserLibraryPage = () => {
  const {
    data: userDocs,
    isError,
    isLoading,
    refetch: refetchUserDocs,
  } = api.user.getUsersDocs.useQuery();

  if (isError) return <div>error</div>;
  if (isLoading)
    return (
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
        <Spinner />
      </div>
    );
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
      <div className="flex items-center justify-between">
        <p className="text-2xl font-semibold tracking-tighter">
          Hello, {userDocs?.name || "User"}
        </p>
        <UploadButton
          appearance={{
            button: buttonVariants({ variant: "default" }),
          }}
          endpoint="imageUploader"
          onClientUploadComplete={(res: any) => {
            // console.log("client upload complete");
            // someway to refetch
            refetchUserDocs();
          }}
          onUploadError={(error: Error) => {
            console.log(error.message);
          }}
        />
      </div>

      <p className="text-muted-foreground">Here are your files</p>
      <div className="flex flex-wrap gap-2">
        {userDocs?.documents?.map((doc) => (
          <Link key={doc.id} href={`/f/${doc.id}`}>
            <div className={cn(buttonVariants({ variant: "ghost" }))}>
              {doc.title}
            </div>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {userDocs.collaborators.map((collab) => (
          <Link key={collab.document.id} href={`/f/${collab.document.id}`}>
            <div className={cn(buttonVariants({ variant: "ghost" }))}>
              {/* <Badge variant="outline">{collab.role}</Badge> */}
              <Badge variant="outline">Collab</Badge>

              {collab.document.title}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
export default UserLibraryPage;

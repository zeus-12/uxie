import { Spinner } from "@/components/Spinner";
import { ChevronLeftIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
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
  if (!userDocs) return <div>Sorry no result found</div>;

  return (
    <div className="container flex w-screen flex-col">
      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "my-2 w-fit justify-start p-2",
        )}
      >
        <ChevronLeftIcon className="mr-2 h-4 w-4" />
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
          endpoint="docUploader"
          onClientUploadComplete={async (res: any) => {
            refetchUserDocs();
            toast({
              title: "Success",
              description: "File uploaded successfully.",
            });
          }}
          onUploadError={(error: Error) => {
            toast({
              title: "Error",
              description: "Something went wrong, please try again later.",
              variant: "destructive",
            });
            console.log(error.message);
          }}
        />
      </div>

      {userDocs?.documents.length +
        userDocs?.collaboratorateddocuments.length ===
      0 ? (
        <p className="text-muted-foreground">
          You have no files yet, upload one now!
        </p>
      ) : (
        <p className="text-muted-foreground">Here are your files</p>
      )}
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
        {userDocs.collaboratorateddocuments.map((collab) => (
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

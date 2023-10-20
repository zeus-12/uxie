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
  } = api.user.getUsersDocs.useQuery();

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
      <div className="flex items-center justify-between">
        <p className="text-2xl font-semibold tracking-tighter">
          Hello, {userDocs?.name || "User"}
        </p>
        <UploadButton
          endpoint="imageUploader"
          onClientUploadComplete={(res: any) => {
            // show toast and refetch files
          }}
          onUploadError={(error: Error) => {
            console.log(error.message);
          }}
        />
      </div>

      <p className="text-muted-foreground">Here are your files</p>
      {userDocs?.documents?.map((doc) => (
        <Link key={doc.id} href={`/f/${doc.id}`}>
          <div>{doc.title}</div>
        </Link>
      ))}
      {userDocs.collaborators.map((collab) => (
        <Link key={collab.document.id} href={`/f/${collab.document.id}`}>
          <Badge variant="outline">Collab</Badge>
          <Badge variant="outline">{collab.role}</Badge>
          <div>{collab.document.title}</div>
        </Link>
      ))}
    </div>
  );
};
export default UserLibraryPage;

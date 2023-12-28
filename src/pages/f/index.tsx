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
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-2 lg:px-16">
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

      <div className="xs:grid-cols-2 grid grid-cols-1 justify-items-center gap-2 md:grid-cols-3 xl:grid-cols-4">
        {/* both combined should be sorted => some array generating logic should be used. */}
        {userDocs?.documents?.map((doc) => (
          <Doc key={doc.id} id={doc.id} title={doc.title} isCollab={false} />
        ))}

        {userDocs.collaboratorateddocuments.map((collab) => (
          <Doc
            key={collab.document.id}
            id={collab.document.id}
            title={collab.document.title}
            isCollab={true}
          />
        ))}
      </div>
    </div>
  );
};

const Doc = ({
  title,
  id,
  isCollab,
}: {
  title: string;
  id: string;
  isCollab: boolean;
}) => {
  return (
    <Link
      key={id}
      href={`/f/${id}`}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "flex w-full flex-col gap-2 border py-8",
      )}
    >
      <p className="mr-auto">
        {title?.slice(0, 30) + (title.length > 30 ? "..." : "") ?? "Untitled"}{" "}
      </p>

      {isCollab && (
        <Badge className="mr-auto" variant="outline">
          Collab
        </Badge>
      )}
      {/* maybe display first page of the pdf here */}
      {/* add menubar to delete, rename doc, download pdf */}
    </Link>
  );
};

export default UserLibraryPage;

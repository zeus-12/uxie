import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomTooltip } from "@/components/ui/tooltip";
import UploadFileModal from "@/components/workspace/upload-file-modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SearchIcon, Sparkle } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useQueryState } from "nuqs";

const UserLibraryPage = () => {
  const {
    data: userDocs,
    isError,
    isLoading,
    refetch: refetchUserDocs,
  } = api.user.getUsersDocs.useQuery();
  const [searchQuery, setSearchQuery] = useQueryState("q", {
    defaultValue: "",
  });

  const session = useSession();
  const userName = session.data?.user.name || "User";
  const docsCount = userDocs?.length ?? 0;

  if (isError) return <div>Something went wrong</div>;
  if (isLoading) return <UserLibrarySkeleton />;
  if (!userDocs) return <div>Sorry no result found</div>;

  const filteredUserDocs = userDocs?.filter((doc) =>
    doc.title.trim().toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-2 lg:px-16 mt-2 md:mt-4 xl:mt-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-2xl font-semibold tracking-tighter">
            Hello, {userName}
          </p>

          {docsCount === 0 ? (
            <p className="text-muted-foreground">
              You have no files yet, upload one now!
            </p>
          ) : (
            <p className="text-muted-foreground">Here are your files</p>
          )}
        </div>

        <UploadFileModal
          docsCount={docsCount}
          refetchUserDocs={refetchUserDocs}
        />
      </div>

      {docsCount > 0 && (
        <div className="flex flex-col justify-center">
          <div className="relative my-4">
            <SearchIcon className="absolute left-3 top-[50%] h-4 w-4 -translate-y-[50%] text-muted-foreground" />
            <Input
              className="pl-9 border-gray-200"
              type="search"
              placeholder="Search for a document"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {filteredUserDocs && filteredUserDocs.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 ">
              {filteredUserDocs?.map((doc) => (
                <DocCard
                  isVectorised={doc.isVectorised}
                  key={doc.id}
                  id={doc.id}
                  title={doc.title}
                  isCollab={doc.isCollab}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No documents found, try changing your search query.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const DocCard = ({
  title,
  id,
  isCollab,
  isVectorised,
}: {
  title: string;
  id: string;
  isCollab: boolean;
  isVectorised: boolean;
}) => {
  return (
    <Link
      prefetch={false}
      key={id}
      href={`/f/${id}`}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "flex flex-col gap-2 border py-8 hover:border-blue-300",
      )}
    >
      <div className="w-full flex justify-between">
        <p className="mr-auto min-w-0 truncate">{title}</p>
        <CustomTooltip
          content={
            isVectorised
              ? "Document is AI vectorised"
              : "Document isn't AI vectorised"
          }
        >
          <Sparkle
            className={cn(
              "h-4 w-4",
              isVectorised ? "text-primary" : "text-gray-200",
            )}
          />
        </CustomTooltip>
      </div>

      {isCollab && (
        <Badge className="mr-auto" variant="outline">
          Collab
        </Badge>
      )}
      {/* add menubar to delete, rename doc, download pdf */}
    </Link>
  );
};

const UserLibrarySkeleton = () => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-2 lg:px-16 mt-2 md:mt-4 xl:mt-6">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex flex-col justify-center">
        <Skeleton className="h-10 w-full my-4" />
        <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserLibraryPage;

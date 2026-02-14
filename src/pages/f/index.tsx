import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import DocCard from "@/components/workspace/doc-card";
import UploadFileModal from "@/components/workspace/upload-file-modal";
import { api } from "@/lib/api";
import { SearchIcon } from "lucide-react";
import { useSession } from "next-auth/react";
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
          <p className="mb-1 text-2xl font-semibold tracking-tight">
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
            <div className="grid grid-cols-1 gap-2 sm:gap-3 md:gap-4 xl:gap-3 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 ">
              {filteredUserDocs?.map((doc) => (
                <DocCard
                  isVectorised={doc.isVectorised}
                  key={doc.id}
                  id={doc.id}
                  title={doc.title}
                  isCollab={doc.isCollab}
                  coverImageUrl={doc.coverImageUrl}
                  pageCount={doc.pageCount}
                  lastReadPage={doc.lastReadPage}
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
            <div
              key={index}
              className="flex flex-col overflow-hidden rounded-md border border-gray-200"
            >
              <Skeleton className="aspect-[3/4] w-full" />
              <div className="flex flex-col gap-1 p-2.5">
                <Skeleton className="h-5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserLibraryPage;

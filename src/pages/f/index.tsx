import { api } from "@/lib/api";

const UserLibraryPage = () => {
  const { data, isError, isLoading } = api.document.getUsersDocs.useQuery();

  if (isLoading) return <div>loading...</div>;
  if (isError) return <div>error</div>;

  return (
    <div>
      {/* {data.userUploadedDocs}
        {data.userCollaboratedDocs} */}
    </div>
  );
};
export default UserLibraryPage;

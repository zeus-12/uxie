// import Editor from "@/components/editor";
// import { SpinnerPage } from "@/components/ui/spinner";
// import { ClientSideSuspense } from "@liveblocks/react";
// import { useSession } from "next-auth/react";
// import { useRouter } from "next/router";
// import { RoomProvider } from "../../../liveblocks.config";

// const CollaborationClient = ({ canEdit }: { canEdit: boolean }) => {
//   const { query } = useRouter();
//   const documentId = query?.docId as string;
//   const session = useSession();
//   const username = session?.data?.user.name ?? "User";

//   return (
//     <RoomProvider
//       id={`doc-${documentId}`}
//       initialPresence={
//         {
//           // TODO: figure out what this is
//           // name: "User",
//           // color: "red",
//         }
//       }
//     >
//       <ClientSideSuspense fallback={<SpinnerPage />}>
//         {() => (
//           <Editor canEdit={canEdit ?? false} username={username ?? "User"} />
//         )}
//       </ClientSideSuspense>
//     </RoomProvider>
//   );
// };

// export default CollaborationClient;

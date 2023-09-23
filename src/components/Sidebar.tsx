// import Chat from "@/components/Chat";
// import Editor from "@/components/Editor";
// import Highlights from "@/components/Highlights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlbumIcon, Highlighter, MessagesSquareIcon } from "lucide-react";
import { IHighlight } from "react-pdf-highlighter";
import testHighlights from "@/lib/test-highlights.json";
import DynamicEditor from "@/components/Editor/DynamicEditor";

const Sidebar = ({} // docId,
// userId,
: {
  // docId: string;
  // userId: string | null;
}) => {
  const highlights = testHighlights;

  return (
    <Tabs
      defaultValue="notes"
      className="max-h-screen max-w-full overflow-hidden"
    >
      <TabsList className="h-12 rounded-ee-none rounded-es-md rounded-se-none rounded-ss-md bg-blue-200">
        <TabsTrigger value="notes">
          <AlbumIcon size={24} />
        </TabsTrigger>

        <TabsTrigger value="chat">
          <MessagesSquareIcon size={24} />
        </TabsTrigger>
        <TabsTrigger value="highlights">
          <Highlighter size={24} />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="notes" className="flex-1 overflow-scroll">
        <DynamicEditor />
      </TabsContent>

      <TabsContent value="chat">
        <div className="relative h-[calc(100vh-4rem)] w-full max-w-screen-lg overflow-scroll break-words border-stone-200 bg-white p-2 sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:p-4 sm:shadow-lg lg:p-8">
          {/* <Chat docId={docId} userId={userId} /> */}
        </div>
      </TabsContent>
      <TabsContent value="highlights">
        <div className="relative h-[calc(100vh-4rem)] w-full max-w-screen-lg overflow-scroll break-words border-stone-200 bg-white p-2 sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:p-4 sm:shadow-lg  lg:p-8 ">
          {/* <Highlights highlights={highlights} docId={docId} /> */}
        </div>
      </TabsContent>
    </Tabs>
  );
};
export default Sidebar;

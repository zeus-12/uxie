import Chat from "@/components/Chat";
// import Highlights from "@/components/Highlights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlbumIcon,
  Download,
  Highlighter,
  MessagesSquareIcon,
} from "lucide-react";
import Editor from "@/components/Editor";
import { saveAs } from "file-saver";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const Sidebar = ({ editor }: { editor: any }) => {
  const handleDownloadMarkdownAsFile = async () => {
    const markdownContent = await editor.blocksToMarkdown(
      editor.topLevelBlocks,
    );

    const blob = new Blob([markdownContent], { type: "text/markdown" });
    saveAs(blob, "notes.md");
  };

  return (
    <>
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
          <Editor editor={editor} />
        </TabsContent>

        <TabsContent value="chat">
          <div className="relative h-[calc(100vh-4rem)] w-full max-w-screen-lg overflow-scroll break-words border-stone-200 bg-white p-2 sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:shadow-lg ">
            <Chat

            // userId={userId}
            />
          </div>
        </TabsContent>
        <TabsContent value="highlights">
          <div className="relative h-[calc(100vh-4rem)] w-full max-w-screen-lg overflow-scroll break-words border-stone-200 bg-white p-2 sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:p-4 sm:shadow-lg  lg:p-8 ">
            {/* <Highlights highlights={highlights} docId={docId} /> */}
          </div>
        </TabsContent>
      </Tabs>

      <div
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "absolute right-5 top-2 cursor-pointer text-xs",
        )}
        onClick={handleDownloadMarkdownAsFile}
      >
        <Download size={18} />
      </div>
    </>
  );
};
export default Sidebar;

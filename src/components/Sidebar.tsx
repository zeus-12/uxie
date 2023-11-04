import Chat from "@/components/Chat";
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
    <div className="bg-gray-50">
      <Tabs
        defaultValue="notes"
        className="max-h-screen max-w-full overflow-hidden"
      >
        <div className="flex items-center justify-between pr-1">
          <TabsList className="h-12 rounded-md bg-gray-200">
            <TabsTrigger value="notes">
              <AlbumIcon size={20} />
            </TabsTrigger>

            <TabsTrigger value="chat">
              <MessagesSquareIcon size={20} />
            </TabsTrigger>
            {/* <TabsTrigger value="highlights">
            <Highlighter size={24} />
          </TabsTrigger> */}
          </TabsList>
          <div
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "ml-auto cursor-pointer border-stone-200 bg-white px-2 text-xs shadow-sm sm:border",
            )}
            onClick={handleDownloadMarkdownAsFile}
          >
            <Download size={20} />
          </div>
        </div>

        <TabsContent
          value="notes"
          className="flex-1 overflow-scroll border-stone-200 bg-white sm:rounded-lg sm:border sm:shadow-lg"
        >
          <Editor editor={editor} />
        </TabsContent>

        <TabsContent value="chat">
          <div className="relative h-[calc(100vh-4rem)] w-full max-w-screen-lg overflow-scroll break-words border-stone-200 bg-white p-2 sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:shadow-lg ">
            <Chat />
          </div>
        </TabsContent>

        {/* <TabsContent value="highlights">
          <div className="relative h-[calc(100vh-4rem)] w-full max-w-screen-lg overflow-scroll break-words border-stone-200 bg-white p-2 sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:p-4 sm:shadow-lg lg:p-8 ">
            <PdfHighlights highlights={highlights}
            
              // docId={docId}
            />
          </div>
        </TabsContent> */}
      </Tabs>
    </div>
  );
};
export default Sidebar;

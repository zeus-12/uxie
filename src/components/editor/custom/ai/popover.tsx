import BouncingLoader from "@/components/ui/bouncing-loader";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useBlockNoteEditor } from "@blocknote/react";
import { useCompletion } from "ai/react";
import { useCommandState } from "cmdk";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Dispatch, SetStateAction, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type AiPopoverProps = {
  rect: AiPopoverPropsRect | null;
  setRect: Dispatch<SetStateAction<AiPopoverPropsRect | null>>;
};

export type AiPopoverPropsRect = {
  top: number;
  left: number;
  width: number;
  blockId: string;
  text: string;
};

const AiPopover = ({ rect, setRect }: AiPopoverProps) => {
  const closePopover = () => {
    setRect(null);
  };

  if (!rect) return;

  return (
    <Popover
      modal={true}
      open={!!rect}
      onOpenChange={(open) => {
        if (!open) {
          closePopover();
        }
      }}
    >
      <PopoverContent
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
        }}
        className="absolute z-[1000] p-0 text-black bg-transparent border-0 shadow-none"
      >
        <Command className="bg-transparent">
          <CommandBody closePopover={closePopover} rect={rect} />
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default AiPopover;

const AI_COMPLETIONS = [
  {
    category: "Edit or review selection",
    items: [
      "Improve writing",
      "Fix spelling & grammar",
      "Summarise",
      "Explain this",
      "Find action items",
      // {
      //   title: "Improve writing",
      // },
      // {
      //   title: "Fix spelling & grammar",
      // },
      // {
      //   title: "Summarise",
      // },
      // {
      //   title: "Explain this",
      // },
      // {
      //   title: "Find action items",
      // },
    ],
  },
];

const CommandBody = ({
  rect,
  closePopover,
}: {
  rect: AiPopoverPropsRect;
  closePopover: () => void;
}) => {
  const [curIndex, setCurIndex] = useState<null | number>(null);
  const [query, setQuery] = useState("");
  const incrementCur = () => {
    setCurIndex(completions.length);
  };

  const editor = useBlockNoteEditor();

  const AI_OPTIONS_AFTER_COMPLETION = [
    {
      title: "Replace selection",

      onClick: () => {
        if (curIndex === null) return;
        const text = completions[curIndex];
        editor.updateBlock(rect.blockId, {
          content: text,
        });
        closePopover();
      },
    },
    {
      title: "Insert below",
      onClick: () => {
        if (curIndex === null) return;
        const text = completions[curIndex];
        editor.insertBlocks(
          [
            {
              content: text,
              type: "paragraph",
            },
          ],
          {
            id: rect.blockId,
          },
          "after",
        );
        closePopover();
      },
    },
  ];

  const [completions, setCompletions] = useState<string[]>([]);

  const filteredCount = useCommandState((state) => state.filtered.count);
  const { complete, completion, stop, isLoading } = useCompletion({
    onFinish: (_prompt, completion) => {
      setCompletions((prev) => [...prev, completion]);
      setQuery("");
    },
    onError: (err) => {
      toast.error("Something went wrong with text generation", {
        duration: 3000,
      });
    },
  });

  const responseExists =
    curIndex !== null &&
    curIndex < completions.length &&
    !!completions[curIndex];
  return (
    <>
      <div className="w-full hover:cursor-auto items-start flex flex-col bg-white max-h-[300px] overflow-y-auto overflow-x-hidden border border-gray-200 rounded-md shadow-md">
        {(isLoading || responseExists) && (
          <ReactMarkdown className="px-2 py-1 prose-sm ">
            {responseExists ? completions[curIndex] : completion}
          </ReactMarkdown>
        )}
        {isLoading ? (
          <div className="flex w-full items-center justify-between px-2">
            <div className="flex items-center gap-1 text">
              <p className="text-sm">AI is writing</p>
              <div className="scale-[80%]">
                <BouncingLoader />
              </div>
            </div>
            <div className="flex gap-2">
              {/* <Button variant="ghost" className="p-1 hover:cursor-pointer">
                <p>Try again</p>
              </Button> */}
              <Button
                variant="ghost"
                onClick={stop}
                size="sm"
                className="p-1 hover:cursor-pointer"
              >
                <p className="text-sm text-gray-700">Stop</p>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between w-full">
            <CommandInput
              rootClassName="border-0"
              leftIcon={
                <Sparkles className="w-4 h-4 text-gray-600 fill-gray-600" />
              }
              rightIcon={
                curIndex !== null ? (
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      className="bg-white p-0 hover:cursor-pointer h-5"
                      disabled={curIndex === 0}
                      onClick={() => {
                        if (curIndex > 0) {
                          setCurIndex(curIndex - 1);
                        }
                      }}
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </Button>
                    <p className="text-xs text-gray-500">
                      {curIndex + 1} of {completions.length}
                    </p>
                    <Button
                      variant="ghost"
                      className="bg-white p-0 hover:cursor-pointer h-5"
                      disabled={curIndex >= completions.length - 1}
                      onClick={() => {
                        if (curIndex < completions.length - 1) {
                          setCurIndex(curIndex + 1);
                        }
                      }}
                    >
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </Button>
                  </div>
                ) : (
                  <></>
                )
              }
              value={query}
              onValueChange={(value) => setQuery(value)}
              className="px-0 py-0 font-normal outline-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-8 flex-1 bg-white border-0"
              autoFocus={true}
              placeholder={
                responseExists
                  ? "Tell AI what to do next"
                  : "Ask AI to edit or generate..."
              }
              onKeyDown={async (e) => {
                if (e.key === "Enter" && filteredCount === 0) {
                  incrementCur();
                  // @ts-ignore
                  complete(`${e.target.value}: ${rect.text}`);
                }
              }}
            />

            {/* <ArrowUpCircle className="w-5 h-5 text-gray-100 fill-gray-600" /> */}
          </div>
        )}
      </div>

      {!isLoading && (
        <>
          {responseExists ? (
            <CommandList
              className={cn(
                "w-[20rem] bg-white border border-gray-200 mt-1 rounded-md shadow-md max-w-[80%]",
                filteredCount === 0 && "border-0",
              )}
            >
              {AI_OPTIONS_AFTER_COMPLETION.map((item: any) => (
                <CommandItem
                  key={item.title}
                  onSelect={() => {
                    item.onClick();
                  }}
                >
                  {item.title}
                </CommandItem>
              ))}
            </CommandList>
          ) : (
            <CommandList
              className={cn(
                "w-[20rem] bg-white border border-gray-200 mt-1 rounded-md shadow-md max-w-[80%]",
                filteredCount === 0 && "border-0",
              )}
            >
              {AI_COMPLETIONS.map((item) => (
                <CommandGroup
                  className="bg-transparent"
                  heading={item.category}
                  key={item.category}
                >
                  {item.items.map((inner) => (
                    <CommandItem
                      onSelect={async () => {
                        incrementCur();
                        complete(`${inner}: ${rect.text}`);
                      }}
                      key={inner}
                    >
                      {inner}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          )}
        </>
      )}
    </>
  );
};

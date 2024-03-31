import BouncingLoader from "@/components/ui/bouncing-loader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { toast } from "@/components/ui/use-toast";
import { useBlockNoteEditor } from "@blocknote/react";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { useCompletion } from "ai/react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type AiPopoverProps = {
  rect: AiPopoverPropsRect;
  setRect: (value: AiPopoverPropsRect) => void;
};

export type AiPopoverPropsRect = {
  top: number;
  left: number;
  width: number;
  blockId: string;
  text: string;
} | null;

const AiPopover = ({ rect, setRect }: AiPopoverProps) => {
  const [completions, setCompletions] = useState<string[]>([]);
  const [curIndex, setCurIndex] = useState<null | number>(null);
  const editor = useBlockNoteEditor();

  const { complete, completion, stop, isLoading } = useCompletion({
    onFinish: (_prompt, completion) => {
      setCompletions((prev) => [...prev, completion]);
      inputRef.current?.focus();
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: "Something went wrong with text generation",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const closePopover = () => {
    setRect(null);
  };

  const responseExists =
    curIndex !== null &&
    curIndex < completions.length &&
    !!completions[curIndex];

  const incrementCur = () => {
    setCurIndex(completions.length);
  };

  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");

  if (!rect) return;

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

  return (
    <Popover
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
        className="absolute z-[1000] border-gray-300 bg-white p-0 text-black"
      >
        <DropdownMenu modal={false} open={!isLoading}>
          <DropdownMenuTrigger className="w-full hover:cursor-auto items-start flex flex-col">
            {(isLoading || responseExists) && (
              <ReactMarkdown className="px-2 py-1 prose ">
                {responseExists ? completions[curIndex] : completion}
              </ReactMarkdown>
            )}
            {isLoading ? (
              <div className="flex w-full items-center justify-between px-2 py-1">
                <div className="flex items-center gap-1">
                  <p>AI is writing</p>
                  <div className="scale-75">
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
                    <p>Stop</p>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between w-full">
                <div className="flex flex-1 items-center gap-2 w-full px-2 py-1">
                  <Sparkles className="w-4 h-4 text-gray-600 fill-gray-600" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    ref={inputRef}
                    className="shadow-0 flex-1 resize-none rounded-md border-0 px-0 py-0 font-normal outline-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-8"
                    autoFocus={true}
                    placeholder={
                      responseExists
                        ? "Tell AI what to do next"
                        : "Ask AI to edit or generate..."
                    }
                    onKeyDown={async (e) => {
                      if (e.key === " ") {
                        // Input under Dropdown.Item does not accept space (OPEN ISSUE)
                        e.stopPropagation();
                      } else if (e.key === "Enter") {
                        incrementCur();
                        // @ts-ignore
                        complete(`${e.target.value}: ${rect.text}`);
                      }
                    }}
                  />
                  {/* <ArrowUpCircle className="w-5 h-5 text-gray-100 fill-gray-600" /> */}
                </div>

                {curIndex !== null && (
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      className="bg-white p-0 hover:cursor-pointer"
                      disabled={curIndex === 0}
                      onClick={() => {
                        if (curIndex > 0) {
                          setCurIndex(curIndex - 1);
                        }
                      }}
                    >
                      <ChevronLeft className="size-6 text-black" />
                    </Button>
                    <p className="w-fit inline text-sm text-gray-500">
                      {curIndex + 1} of {completions.length}
                    </p>
                    <Button
                      variant="ghost"
                      className="bg-white p-0 hover:cursor-pointer"
                      disabled={curIndex >= completions.length - 1}
                      onClick={() => {
                        if (curIndex < completions.length - 1) {
                          setCurIndex(curIndex + 1);
                        }
                      }}
                    >
                      <ChevronRight className="size-6 text-black" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[20rem] max-w-[80%] empty:hidden"
          >
            {responseExists
              ? AI_OPTIONS_AFTER_COMPLETION.map((item) => (
                  <div key={item.title}>
                    <DropdownMenuItem
                      onClick={() => {
                        item.onClick();
                      }}
                      key={item.title}
                    >
                      {item.title}
                    </DropdownMenuItem>
                  </div>
                ))
              : AI_COMPLETIONS.map((item) => {
                  const newItems = item.items.filter((inner) =>
                    inner.toLowerCase().includes(query.trim().toLowerCase()),
                  );
                  return {
                    ...item,
                    items: newItems,
                  };
                })
                  .filter((item) => item.items.length > 0)
                  .map((item) => (
                    <div key={item.category}>
                      <DropdownMenuLabel key={item.category}>
                        {item.category}
                      </DropdownMenuLabel>
                      {item.items.map((inner) => (
                        <DropdownMenuItem
                          onClick={async () => {
                            incrementCur();
                            complete(`${inner}: ${rect.text}`);
                          }}
                          key={inner}
                        >
                          {inner}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
          </DropdownMenuContent>
        </DropdownMenu>
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

import { Popover, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useCompletion } from "ai/react";
import { toast } from "@/components/ui/use-toast";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useElementSize } from "@/hooks/useElementSize";
import BouncingDotsLoader from "@/components/BouncingDotsLoader";
import { useBlockNoteEditor } from "@blocknote/react";

type AiPopoverProps = {
  rect: AiPopoverPropsRect;
  setRect: (value: AiPopoverPropsRect) => void;
};

export type AiPopoverPropsRect = {
  top: number;
  left: number;
  width: number;
  blockId: string;
} | null;

const AiPopover = ({ rect, setRect }: AiPopoverProps) => {
  const [completions, setCompletions] = useState<string[]>([]);
  const [curIndex, setCurIndex] = useState<null | number>(null);
  const editor = useBlockNoteEditor();

  const { complete, completion, stop, isLoading } = useCompletion({
    onFinish: (_prompt, completion) => {
      setCompletions((prev) => [...prev, completion]);
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

  // const isLoading = true;
  const { ref, height: aiTextBoxHeight } = useElementSize();

  const responseExists =
    curIndex !== null &&
    curIndex < completions.length &&
    !!completions[curIndex];

  const incrementCur = () => {
    setCurIndex(completions.length);
  };

  if (!rect) return;

  const AI_OPTIONS_AFTER_COMPLETION = [
    {
      title: "Replace selection",

      onClick: () => {
        console.log("clicked", curIndex);
        if (curIndex === null) return;
        const text = completions[curIndex];
        console.log(text);
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
        <div ref={ref}>
          {(isLoading || responseExists) && (
            <ReactMarkdown className="px-2 py-1">
              {responseExists ? completions[curIndex] : completion}
            </ReactMarkdown>
          )}
          {isLoading ? (
            <div className="flex items-center justify-between px-2 py-1">
              <div className="flex items-center gap-1">
                <p>AI is writing</p>
                <div className="scale-75">
                  <BouncingDotsLoader />
                </div>
              </div>
              <div className="flex gap-2">
                {/* <Button variant="ghost" className="p-1 hover:cursor-pointer">
                  <p>Try again</p>
                </Button> */}
                <Button
                  variant="ghost"
                  onClick={stop}
                  className="p-1 hover:cursor-pointer"
                >
                  <p>Stop</p>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between">
              <Input
                className="shadow-0 flex-1 resize-none rounded-md border-0 px-3 py-2 font-normal outline-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                autoFocus={true}
                placeholder={
                  responseExists
                    ? "Tell AI what to do next"
                    : "Ask AI to edit or generate..."
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    incrementCur();
                    complete(e.currentTarget.value);
                  }
                }}
              />

              {curIndex !== null && (
                <div className="flex items-center">
                  <Button
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
                  {curIndex + 1} of {completions.length}
                  <Button
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
        </div>

        {aiTextBoxHeight && (
          <DropdownMenu modal={false} open={!isLoading}>
            <DropdownMenuContent
              className="absolute z-[1000]"
              style={{
                top: rect.top + aiTextBoxHeight + 5,
                left: rect.left,
                minWidth: "20rem",
              }}
            >
              {responseExists
                ? AI_OPTIONS_AFTER_COMPLETION.map((item) => (
                    <DropdownMenuItem
                      onClick={() => {
                        item.onClick();
                      }}
                      key={item.title}
                    >
                      {item.title}
                    </DropdownMenuItem>
                  ))
                : AI_COMPLETIONS.filter((item) => item.items.length > 0).map(
                    (item) => (
                      <div key={item.category}>
                        <DropdownMenuLabel key={item.category}>
                          {item.category}
                        </DropdownMenuLabel>
                        {item.items.map((item) => (
                          <DropdownMenuItem
                            onClick={() => {
                              incrementCur();
                              complete(item.title);
                            }}
                            key={item.title}
                          >
                            {item.title}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ),
                  )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default AiPopover;

const AI_COMPLETIONS = [
  {
    category: "Edit or review selection",
    items: [
      {
        title: "Improve writing",
      },
      {
        title: "Fix spelling & grammar",
      },
      {
        title: "Summarise",
      },
      {
        title: "Explain this",
      },
      {
        title: "Find action items",
      },
    ],
  },
];

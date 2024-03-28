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

const AiPopover = ({
  rect,
  setRect,
}: {
  rect: null | any;
  setRect: (value: any) => void;
}) => {
  const [completions, setCompletions] = useState<string[]>([]);
  const [curIndex, setCurIndex] = useState<null | number>(null);

  const { complete, completion, isLoading, stop } = useCompletion({
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

  const { ref, height: aiTextBoxHeight } = useElementSize();

  const responseExists =
    curIndex !== null &&
    curIndex < completions.length &&
    !!completions[curIndex];

  const incrementCur = () => {
    setCurIndex(completions.length);
  };

  return (
    <Popover
      open={!!rect}
      onOpenChange={(open) => {
        if (!open) {
          setRect(null);
        }
      }}
    >
      <PopoverContent
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
        }}
        className="absolute z-[1000] border-gray-300 bg-white p-0 text-black "
      >
        <div ref={ref}>
          <ReactMarkdown>
            {responseExists ? completions[curIndex] : completion}
          </ReactMarkdown>
          {isLoading ? (
            <div className="flex justify-between">
              <p>AI is writing...</p>
              <div>
                <p>Try again</p>
                <p onClick={stop}>Stop</p>
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
              {!responseExists
                ? AI_OPTIONS_INITIAL.filter(
                    (item) => item.items.length > 0,
                  ).map((item) => (
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
                  ))
                : AI_OPTIONS_WITH_RESPONSE.map((item) => (
                    <DropdownMenuItem
                      onClick={() => {
                        item.onClick();
                      }}
                      key={item.title}
                    >
                      {item.title}
                    </DropdownMenuItem>
                  ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default AiPopover;

const AI_OPTIONS_INITIAL = [
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

const AI_OPTIONS_WITH_RESPONSE = [
  {
    title: "Replace selection",

    onClick: () => {},
  },
  {
    title: "Insert below",
    onClick: () => {},
  },
];

import { Button } from "@/components/ui/button";
import { MotionConfig } from "framer-motion";
import { ArrowLeft, AudioLines } from "lucide-react";
import { ReactNode, useRef, useState } from "react";

const transition = {
  type: "spring",
  bounce: 0.1,
  duration: 0.2,
};

const ReaderBottomToolbar = ({
  children,
  isAudioDisabled,
  currentWord,
  pageNumberInView,
}: {
  children: ReactNode;
  isAudioDisabled: boolean;
  currentWord: string | undefined;
  pageNumberInView: number;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <MotionConfig transition={transition}>
      <div
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50"
        ref={containerRef}
      >
        <div className="relative flex items-stretch gap-2">
          <div className="h-full w-full rounded-xl border border-zinc-950/10 bg-white">
            {/* <motion.div
            animate={
              {
                // @todo: here I want to remove the width
                // minWidth: isOpen ? "200px" : "30px",
              }
            }
            initial={false}
          > */}
            <div className="overflow-hidden py-1 px-1">
              {!isOpen ? (
                <div className="grid gap-2 w-full justify-evenly grid-cols-2">
                  <Button variant="ghost" size="sm" className="w-full">
                    {pageNumberInView}
                  </Button>

                  <Button
                    className="w-full"
                    onClick={() => setIsOpen(true)}
                    variant="ghost"
                    size="sm"
                    disabled={isAudioDisabled}
                  >
                    <AudioLines className="h-5 w-5" />
                  </Button>
                </div>
              ) : (
                <div className="flex space-x-2 w-fit items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="relative w-full">{children}</div>
                </div>
              )}
            </div>
            {/* </motion.div> */}
          </div>

          {isOpen && currentWord && (
            <div className="absolute rounded-xl border border-zinc-950/10 bg-white w-fit mx-auto px-2 py-[10px] -right-1 translate-x-[100%]">
              <p className="text-lg font-semibold text-blue-600">
                {currentWord}
              </p>
            </div>
          )}
        </div>
      </div>
    </MotionConfig>
  );
};

export default ReaderBottomToolbar;

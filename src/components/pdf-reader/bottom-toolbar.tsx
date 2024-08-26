// CREDITS: https://motion-primitives.com/docs/toolbar-dynamic

import { Button } from "@/components/ui/button";
import useClickOutside from "@/hooks/use-click-outside";
import { MotionConfig, motion } from "framer-motion";
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
}: {
  children: ReactNode;
  isAudioDisabled: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => {
    setIsOpen(false);
  });

  return (
    <MotionConfig transition={transition}>
      <div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50"
        ref={containerRef}
      >
        <div className="h-full w-full rounded-xl border border-zinc-950/10 bg-white">
          <motion.div
            animate={{
              // @todo: here I want to remove the width
              minWidth: isOpen ? "240px" : "64px",
            }}
            initial={false}
          >
            <div className="overflow-hidden p-2">
              {!isOpen ? (
                <div className="flex space-x-2 justify-evenly">
                  {/* <Button disabled>
                    <User className="h-5 w-5" />
                  </Button> */}
                  <Button
                    onClick={() => setIsOpen(true)}
                    variant="ghost"
                    disabled={isAudioDisabled}
                  >
                    <AudioLines className="h-5 w-5" />
                  </Button>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="relative w-full">
                    {children}
                    <div className="absolute right-1 top-0 flex h-full items-center justify-center"></div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
};

export default ReaderBottomToolbar;

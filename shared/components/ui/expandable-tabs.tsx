import { cn } from "../../lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import { useMediaQuery, useOnClickOutside } from "usehooks-ts";
import { SMALL_SCREEN_QUERY } from "../../lib/constants";

export interface TabPanelState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface Tab {
  children: React.ReactNode;
  icon: React.ReactNode | ((panel: TabPanelState) => React.ReactNode);
  clickOutsideToClose: boolean;
  closeOnChildClick?: boolean;
}

const buttonVariants = {
  initial: {
    gap: 0,
    paddingLeft: ".1rem",
    paddingRight: ".1rem",
  },
  animate: (isSelected: boolean) => ({
    gap: isSelected ? ".2rem" : 0,
    paddingLeft: isSelected ? "0.2rem" : ".1rem",
    paddingRight: isSelected ? "0.2rem" : ".1rem",
  }),
};

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring", bounce: 0, duration: 0.6 };

const floatingPanelVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const floatingPanelTransition = { duration: 0.12, ease: "easeOut" } as const;

export function ExpandableTabs({ tabs }: { tabs: Tab[] }) {
  const [selected, setSelected] = React.useState<number | null>(null);
  const outsideClickRef = React.useRef(null);
  const isSmallScreen = useMediaQuery(SMALL_SCREEN_QUERY);

  useOnClickOutside(outsideClickRef, () => {
    if (selected === null) {
      return;
    }

    const tab = tabs[selected];
    if (tab?.clickOutsideToClose) setSelected(null);
  });

  const handleSelect = (index: number) =>
    setSelected(index === selected ? null : index);

  return (
    <div
      ref={outsideClickRef}
      className="relative flex w-max max-w-[calc(100vw-1rem)] items-center divide-x rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_4px_16px_-4px_rgb(0_0_0/0.18)]"
    >
      {tabs.map((tab, index) => {
        const isOpen = selected === index;
        const expandsInline = isOpen && !!tab.children;
        return (
          <div className="flex shrink-0 justify-center" key={index}>
            <motion.div
              key={index}
              variants={buttonVariants}
              initial={false}
              animate="animate"
              custom={expandsInline}
              transition={transition}
              className="mx-0.5 flex shrink-0 items-center rounded-xl text-sm font-medium md:mx-1"
            >
              <div
                className={cn(
                  "my-1 flex rounded-md p-0.5 text-muted-foreground transition-colors duration-150 hover:cursor-pointer hover:text-foreground md:p-1",
                  expandsInline || (isOpen && typeof tab.icon === "function")
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted",
                )}
                onClick={() => handleSelect(index)}
              >
                {typeof tab.icon === "function"
                  ? tab.icon({
                      open: isOpen,
                      onOpenChange: (open) => {
                        if (open) setSelected(index);
                        else
                          setSelected((current) =>
                            current === index ? null : current,
                          );
                      },
                    })
                  : tab.icon}
              </div>

              <AnimatePresence initial={false}>
                {expandsInline && (
                  <motion.div
                    variants={
                      isSmallScreen ? floatingPanelVariants : spanVariants
                    }
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={
                      isSmallScreen ? floatingPanelTransition : transition
                    }
                    className="overflow-hidden max-md:absolute max-md:bottom-[calc(100%+0.75rem)] max-md:left-1/2 max-md:z-50 max-md:max-w-[calc(100vw-1rem)] max-md:-translate-x-1/2 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-popover max-md:p-1 max-md:shadow-lg"
                    onClick={() => {
                      if (tab.closeOnChildClick) setSelected(null);
                    }}
                  >
                    {tab.children}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

import { cn } from "../../lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import { useOnClickOutside } from "usehooks-ts";

export interface Tab {
  children: React.ReactNode;
  icon: React.ReactNode;
  clickOutsideToClose: boolean;
  closeOnChildClick?: boolean;
}

interface ExpandableTabsProps {
  tabs: Tab[];
  onChange?: (index: number | null) => void;
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

export function ExpandableTabs({ tabs, onChange }: ExpandableTabsProps) {
  const [selected, setSelected] = React.useState<number | null>(null);
  const outsideClickRef = React.useRef(null);

  useOnClickOutside(outsideClickRef, () => {
    if (selected === null) {
      return;
    }

    const tab = tabs[selected];
    if (tab?.clickOutsideToClose) {
      setSelected(null);
      onChange?.(null);
    }
  });

  const handleSelect = (index: number) => {
    if (index == selected) {
      setSelected(null);
      onChange?.(null);
      return;
    }
    setSelected(index);
    onChange?.(index);
  };

  return (
    <div
      ref={outsideClickRef}
      className="relative flex w-max max-w-[calc(100vw-1rem)] items-center divide-x rounded-2xl border border-gray-200 bg-background shadow-sm"
    >
      {tabs.map((tab, index) => (
        <div className="flex shrink-0 justify-center" key={index}>
          <motion.div
            key={index}
            variants={buttonVariants}
            initial={false}
            animate="animate"
            custom={selected === index && !!tab.children}
            transition={transition}
            className="mx-0.5 flex shrink-0 items-center rounded-xl text-sm font-medium md:mx-1"
          >
            <div
              className={cn(
                "my-1 flex rounded-md p-0.5 text-muted-foreground transition-colors duration-150 hover:cursor-pointer hover:text-foreground md:p-1",
                selected === index && !!tab.children
                  ? "bg-muted text-foreground"
                  : "hover:bg-muted",
              )}
              onClick={() => handleSelect(index)}
            >
              {tab.icon}
            </div>

            <AnimatePresence initial={false}>
              {selected === index && !!tab.children && (
                <motion.div
                  variants={spanVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                  className="overflow-hidden max-md:absolute max-md:bottom-[calc(100%+0.75rem)] max-md:left-1/2 max-md:z-50 max-md:max-w-[calc(100vw-1rem)] max-md:-translate-x-1/2 max-md:rounded-xl max-md:border max-md:border-gray-200 max-md:bg-background max-md:p-1 max-md:shadow-lg"
                  onClick={() => {
                    if (!tab.closeOnChildClick) return;
                    setSelected(null);
                    onChange?.(null);
                  }}
                >
                  {tab.children}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

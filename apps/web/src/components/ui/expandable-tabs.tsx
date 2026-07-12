import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import { useOnClickOutside } from "usehooks-ts";

export interface Tab {
  children: React.ReactNode;
  icon: React.ReactNode;
  clickOutsideToClose: boolean;
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
      className="flex items-center rounded-2xl border bg-background shadow-sm divide-x border-gray-200"
    >
      {tabs.map((tab, index) => (
        <div className="flex justify-center" key={index}>
          <motion.div
            key={index}
            variants={buttonVariants}
            initial={false}
            animate="animate"
            custom={selected === index && !!tab.children}
            transition={transition}
            className={cn(
              "relative flex items-center mx-1 rounded-xl text-sm font-medium shrink-0",
            )}
          >
            <div
              className={cn(
                "rounded-md flex my-1 transition-colors duration-300 hover:cursor-pointer p-1",
                selected === index && !!tab.children
                  ? "text-black"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
                  className="overflow-hidden"
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

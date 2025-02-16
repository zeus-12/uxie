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
    paddingLeft: ".5rem",
    paddingRight: ".5rem",
  },
  animate: (isSelected: boolean) => ({
    gap: isSelected ? ".5rem" : 0,
    paddingLeft: isSelected ? "0.75rem" : ".5rem",
    paddingRight: isSelected ? "0.75rem" : ".5rem",
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

  // const Separator = () => (
  //   <div className="mx-1 h-[24px] w-[1.2px] bg-border" aria-hidden="true" />
  // );

  return (
    <div
      ref={outsideClickRef}
      className="flex items-center rounded-2xl border bg-background p-1 shadow-sm divide-x border-gray-200"
    >
      {tabs.map((tab, index) => {
        // if ("type" in tab && tab.type === "separator") {
        //   return <Separator key={`separator-${index}`} />;
        // } else if ("type" in tab) {
        //   return;
        // }

        return (
          <div className="flex justify-center" key={index}>
            <motion.div
              key={index}
              variants={buttonVariants}
              initial={false}
              animate="animate"
              custom={selected === index}
              transition={transition}
              className={cn(
                "relative flex items-center px-0 mx-1 py-1 rounded-xl text-sm font-medium transition-colors duration-300 shrink-0",
                selected === index
                  ? "text-black"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <div onClick={() => handleSelect(index)}>{tab.icon}</div>
              <AnimatePresence initial={false}>
                {selected === index && (
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
        );
      })}
    </div>
  );
}

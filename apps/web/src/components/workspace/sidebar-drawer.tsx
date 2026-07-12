import { Button } from "@/components/ui/button";
import { useMobileSidebarStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PanelBottomOpen } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

export const SidebarDrawerTrigger = () => {
  const setDrawerOpen = useMobileSidebarStore((s) => s.setDrawerOpen);

  return (
    <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(true)}>
      <PanelBottomOpen className="h-5 w-5" />
    </Button>
  );
};

export const SidebarDrawerContent = ({ children }: { children: ReactNode }) => {
  const isOpen = useMobileSidebarStore((s) => s.isDrawerOpen);
  const setDrawerOpen = useMobileSidebarStore((s) => s.setDrawerOpen);

  // Drag to close
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? 0;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0]?.clientY ?? 0;
    const diff = currentY - startY.current;
    if (diff > 0) {
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 100) {
      setDrawerOpen(false);
    }
    setDragY(0);
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setDrawerOpen(false)}
      />

      <div
        style={{
          transform: isOpen ? `translateY(${dragY}px)` : "translateY(100%)",
        }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 h-5/6 bg-gray-50 rounded-t-xl shadow-2xl",
          !isDragging && "transition-transform duration-300 ease-out",
        )}
      >
        <div
          className="flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="h-1.5 w-12 rounded-full bg-gray-300" />
        </div>

        {/* Content */}
        <div className="h-[calc(100%-2rem)] overflow-auto">{children}</div>
      </div>
    </>
  );
};

const SidebarDrawer = () => <SidebarDrawerTrigger />;
export default SidebarDrawer;

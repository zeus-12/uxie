import { Button } from "@/components/ui/button";
import { usePdfSettingsStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

export const PanelToggle = () => {
  const sidebarHidden = usePdfSettingsStore((state) => state.sidebarHidden);
  const toggleSidebar = usePdfSettingsStore((state) => state.toggleSidebar);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        toggleSidebar();
      }}
      className="hidden md:flex h-full w-full items-center justify-center"
    >
      <Button variant="ghost" size="xs" className="block">
        {sidebarHidden ? (
          <PanelRightOpen
            size={20}
            className={cn("text-muted-foreground transition-colors")}
          />
        ) : (
          <PanelRightClose size={20} className="transition-colors" />
        )}
      </Button>
    </div>
  );
};

import { Button } from "../../ui/button";
import { usePdfSettingsStore } from "../../../lib/store";
import { cn } from "../../../lib/utils";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

export const PanelToggle = () => {
  const sidebarHidden = usePdfSettingsStore((state) => state.sidebarHidden);
  const toggleSidebar = usePdfSettingsStore((state) => state.toggleSidebar);

  return (
    <div className="hidden h-full w-full items-center justify-center md:flex">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="block"
        aria-label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
        title={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
        onClick={(event) => {
          event.stopPropagation();
          toggleSidebar();
        }}
      >
        {sidebarHidden ? (
          <PanelRightOpen
            aria-hidden="true"
            size={20}
            className={cn("text-muted-foreground transition-colors")}
          />
        ) : (
          <PanelRightClose
            aria-hidden="true"
            size={20}
            className="transition-colors"
          />
        )}
      </Button>
    </div>
  );
};

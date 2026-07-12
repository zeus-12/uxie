import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { XIcon } from "lucide-react";

type FloatingPanelProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

export function FloatingPanel({
  open,
  onClose,
  children,
  className,
}: FloatingPanelProps) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn("mb-2 w-[400px]", className)}
    >
      <div className="bg-background border rounded-xl shadow-xl overflow-hidden relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <XIcon size={16} className="text-muted-foreground" />
        </button>
        {children}
      </div>
    </motion.div>
  );
}

type FloatingPanelBodyProps = {
  children: React.ReactNode;
  className?: string;
};

export function FloatingPanelBody({
  children,
  className,
}: FloatingPanelBodyProps) {
  return (
    <div
      className={cn(
        "px-6 py-6 flex flex-col items-center justify-center min-h-[100px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

type FloatingPanelFooterProps = {
  children: React.ReactNode;
  className?: string;
};

export function FloatingPanelFooter({
  children,
  className,
}: FloatingPanelFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 bg-muted/30 border-t",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FloatingPanelIconButton({
  onClick,
  icon,
  title,
  active,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={active ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      className="h-8 w-8 p-0"
      title={title}
      disabled={disabled}
    >
      {icon}
    </Button>
  );
}

import type { ReactNode } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "../ui/button";

// The calm, centered empty state shared by the chat gate and the flashcard
// generator — a soft icon, a short line, and a single rounded action.
export function EmptyStatePrompt({
  icon,
  title,
  subtext,
  buttonText,
  onClick,
  loading = false,
  loadingText,
}: {
  icon?: ReactNode;
  title: string;
  subtext?: string;
  buttonText: string;
  onClick: () => void;
  loading?: boolean;
  loadingText?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div>
        <p className="font-medium">{title}</p>
        {subtext && (
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {subtext}
          </p>
        )}
      </div>
      <Button onClick={onClick} disabled={loading} className="rounded-full">
        {loading && <Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />}
        {loading ? loadingText ?? buttonText : buttonText}
      </Button>
    </div>
  );
}

import { FileText, Sparkle, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { CustomTooltip } from "../ui/tooltip";

const ProgressRing = ({
  progress,
  size = 20,
  strokeWidth = 2,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-gray-200"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary"
      />
    </svg>
  );
};

export function DocCard({
  title,
  isCollab,
  isVectorised,
  coverImageUrl,
  pageCount,
  lastReadPage,
  onOpen,
  onDelete,
}: {
  title: string;
  isCollab: boolean;
  isVectorised: boolean;
  coverImageUrl?: string | null;
  pageCount: number;
  lastReadPage: number | null;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const showProgress = lastReadPage !== null && pageCount > 0;
  const readingProgress = showProgress
    ? Math.round((lastReadPage / pageCount) * 100)
    : 0;

  return (
    <div className="group block w-full [perspective:800px]">
      <div
        onClick={onOpen}
        className={cn(
          "relative flex cursor-pointer flex-col overflow-hidden rounded-md bg-white",
          "border border-gray-200 shadow-sm",
          "transition-all duration-300 ease-out",
          "group-hover:border-gray-300 group-hover:shadow-lg",
          "[transform-style:preserve-3d] [transform-origin:left_center]",
          "group-hover:[transform:rotateY(-6deg)]",
        )}
      >
        <div className="relative aspect-[3/4] w-full bg-gray-50">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <FileText className="h-12 w-12 text-gray-300" />
            </div>
          )}

          {showProgress && (
            <CustomTooltip content={`${readingProgress}% read`}>
              <div className="absolute bottom-2 right-2 flex items-center justify-center rounded-full bg-white/90 p-1 shadow-sm backdrop-blur-sm">
                <ProgressRing
                  progress={readingProgress}
                  size={18}
                  strokeWidth={2}
                />
              </div>
            </CustomTooltip>
          )}

          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="absolute right-2 top-2 hidden rounded-md bg-white/90 p-1.5 text-gray-500 shadow-sm backdrop-blur-sm hover:text-red-500 group-hover:block"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1 p-2.5">
          <div className="flex w-full items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-medium">{title}</p>
            <CustomTooltip
              content={
                isVectorised
                  ? "Document is AI vectorised"
                  : "Document isn't AI vectorised"
              }
            >
              <Sparkle
                className={cn(
                  "h-4 w-4 shrink-0",
                  isVectorised ? "text-primary" : "text-gray-200",
                )}
              />
            </CustomTooltip>
          </div>

          {isCollab && (
            <Badge className="mr-auto" variant="outline">
              Collab
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
